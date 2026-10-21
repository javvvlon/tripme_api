import type { CacheService } from '~/shared/cache/cache.service'
import type { IEsimCountry, IEsimPlan, IEsimProvider, IIssuedEsim } from './esim-provider'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IEsimoPackage {
  id?: string
  planName?: string
  coverage?: string
  url?: string
  dataGBAmount?: number
  isUnlimited?: boolean
  duration?: number
  price?: number
  currency?: string
}

export type EsimoCatalog = Record<string, IEsimPlan[]>

export const ESIMO_API_URL = 'https://europe-west3-mct-esimo.cloudfunctions.net/getAllPackages'

export const ESIMO_CATALOG_TTL_MS = 6 * 60 * 60 * 1000

export const ESIMO_UNLIMITED_DAYS = [1, 3, 5, 7, 10, 15, 30]

const COUNTRY = /^[A-Z]{2}$/

const TIMEOUT_MS = 20_000

export function esimoPlan(item: IEsimoPackage): IEsimPlan | null {
  const country = String(item.coverage ?? '').trim().toUpperCase()
  const days = Number(item.duration)
  const usd = Number(item.price)
  const volume = Number(item.dataGBAmount)
  const unlimited = item.isUnlimited === true || volume < 0

  if (!item.id || !COUNTRY.test(country) || !(days > 0) || !(usd > 0)) return null
  if (String(item.currency ?? 'USD').toUpperCase() !== 'USD') return null
  if (unlimited ? !ESIMO_UNLIMITED_DAYS.includes(days) : !(volume > 0)) return null

  return {
    id: item.id,
    country,
    title: item.planName || item.id,
    dataMb: unlimited ? null : Math.round(volume * 1024),
    days,
    wholesaleUsd: Math.round(usd * 100) / 100,
    networks: [],
  }
}

export function esimoCatalog(list: unknown): EsimoCatalog {
  const catalog: EsimoCatalog = {}

  for (const item of Array.isArray(list) ? list as IEsimoPackage[] : []) {
    const plan = esimoPlan(item)

    if (plan) (catalog[plan.country] ??= []).push(plan)
  }

  for (const plans of Object.values(catalog)) plans.sort((a, b) => a.wholesaleUsd - b.wholesaleUsd)

  return catalog
}

export async function fetchEsimoPackages(url: string): Promise<unknown> {
  const target = new URL(url)

  target.searchParams.set('currency', 'usd')

  const response = await fetch(target, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'TripMe/1.0 (+https://tripme.uz)' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  if (!response.ok) throw new Error(`esimo packages answered ${response.status}`)

  return response.json()
}

export class EsimoProvider implements IEsimProvider {
  readonly name = 'esimo'
  readonly canIssue = false

  private memory: { catalog: EsimoCatalog, at: number } | null = null

  constructor(
    private readonly load: () => Promise<unknown>,
    private readonly cache?: CacheService,
  ) {}

  async countries(): Promise<IEsimCountry[]> {
    return Object.entries(await this.catalog()).map(([code, plans]) => ({
      code,
      plans: plans.length,
      fromUsd: Math.min(...plans.map(plan => plan.wholesaleUsd)),
    }))
  }

  async plans(country: string): Promise<IEsimPlan[]> {
    return (await this.catalog())[country.toUpperCase()] ?? []
  }

  async plan(id: string): Promise<IEsimPlan | null> {
    const country = id.split('_').at(-1) ?? ''

    return (await this.plans(country)).find(plan => plan.id === id) ?? null
  }

  async issue(): Promise<IIssuedEsim> {
    throw new Error('eSIMo eSIMs are bought by the client in the eSIMo app')
  }

  private async catalog(): Promise<EsimoCatalog> {
    if (this.memory && Date.now() - this.memory.at < ESIMO_CATALOG_TTL_MS) return this.memory.catalog

    const key = 'esim:esimo:catalog'
    const cached = await this.cache?.getJson<EsimoCatalog>(key)

    if (cached && Object.keys(cached).length) {
      this.memory = { catalog: cached, at: Date.now() }

      return cached
    }

    try {
      const catalog = esimoCatalog(await this.load())

      if (Object.keys(catalog).length) {
        await this.cache?.setJson(key, catalog, ESIMO_CATALOG_TTL_MS)
        this.memory = { catalog, at: Date.now() }
      }

      return catalog
    }
    catch {
      return this.memory?.catalog ?? {}
    }
  }
}
