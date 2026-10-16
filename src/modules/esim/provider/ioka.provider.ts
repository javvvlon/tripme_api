import type { CacheService } from '~/shared/cache/cache.service'
import type { IEsimCountry, IEsimPlan, IEsimProvider, IIssuedEsim } from './esim-provider'
import type { IIokaSource } from './ioka.source'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IIokaCountry {
  code: string
  name: string
}

export interface IIokaPackage {
  id: string
  name: string
  country_codes?: string[]
  data_volume_mb?: number
  is_unlimited?: boolean
  validity?: number
  price?: string
  price_usd?: string
  price_uzs?: string
  coverage?: Array<{ country_code: string, networks?: Array<{ name?: string | null }> }>
}

interface IIokaPage<T> {
  items?: T[]
  totals?: number
}

export const IOKA_CATALOG_TTL_MS = 6 * 60 * 60 * 1000

const PAGE = 200
const MAX_PAGES = 5
const PARALLEL = 6
const COUNTRY = /^[a-z]{2}$/

const itemsOf = <T>(page: unknown): T[] => {
  const items = (page as IIokaPage<T> | null)?.items

  return Array.isArray(items) ? items : []
}

export function iokaPlan(item: IIokaPackage, country: string): IEsimPlan | null {
  const code = country.toLowerCase()
  const days = Number(item.validity)
  const usd = Number(item.price_usd ?? item.price)
  const uzs = Number(item.price_uzs)

  if (!item.id || !(days > 0) || !(usd > 0)) return null

  const unlimited = item.is_unlimited === true || /unlim/i.test(item.name ?? '')
  const volume = Number(item.data_volume_mb)
  const networks = (item.coverage ?? [])
    .filter(entry => entry.country_code?.toLowerCase() === code)
    .flatMap(entry => (entry.networks ?? []).map(network => network.name?.trim() ?? ''))
    .filter(Boolean)

  return {
    id: item.id,
    country: code.toUpperCase(),
    title: item.name || item.id,
    dataMb: unlimited || !(volume > 0) ? null : volume,
    days,
    wholesaleUsd: usd,
    ...(uzs > 0 ? { retailUzs: Math.round(uzs) } : {}),
    networks: [...new Set(networks)],
  }
}

async function inBatches<T, R>(items: T[], size: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []

  for (let i = 0; i < items.length; i += size) out.push(...await Promise.all(items.slice(i, i + size).map(task)))

  return out
}

export class IokaEsimProvider implements IEsimProvider {
  readonly name = 'ioka'
  readonly canIssue = false

  constructor(
    private readonly source: IIokaSource,
    private readonly cache?: CacheService,
  ) {}

  async countries(): Promise<IEsimCountry[]> {
    return this.cached('esim:ioka:countries', async () => {
      const list = (await this.countryList()).filter(country => COUNTRY.test(country.code))
      const plans = await inBatches(list, PARALLEL, country => this.packages(country.code))

      return list
        .map((country, i) => ({ code: country.code.toUpperCase(), plans: plans[i]! }))
        .filter(entry => entry.plans.length)
        .map(entry => ({
          code: entry.code,
          plans: entry.plans.length,
          fromUsd: Math.min(...entry.plans.map(plan => plan.wholesaleUsd)),
          ...(entry.plans.every(plan => plan.retailUzs) ? { fromUzs: Math.min(...entry.plans.map(plan => plan.retailUzs!)) } : {}),
        }))
    })
  }

  async plans(country: string): Promise<IEsimPlan[]> {
    return COUNTRY.test(country.toLowerCase()) ? this.packages(country.toLowerCase()) : []
  }

  async plan(id: string): Promise<IEsimPlan | null> {
    const country = /:([a-z]{2})-/i.exec(id)?.[1]

    if (!country) return null

    return (await this.packages(country.toLowerCase())).find(plan => plan.id === id) ?? null
  }

  async issue(): Promise<IIssuedEsim> {
    throw new Error('ioka eSIMs are bought in the partner cabinet, not issued here')
  }

  private async countryList(): Promise<IIokaCountry[]> {
    const out: IIokaCountry[] = []

    for (let page = 0; page < MAX_PAGES; page++) {
      const items = itemsOf<IIokaCountry>(await this.source.get('/esim/countries', { limit: PAGE, offset: page * PAGE }))

      out.push(...items.filter(item => typeof item?.code === 'string').map(item => ({ code: item.code.toLowerCase(), name: item.name })))

      if (items.length < PAGE) break
    }

    return out
  }

  private async packages(code: string): Promise<IEsimPlan[]> {
    return this.cached(`esim:ioka:packages:${code}`, async () => {
      try {
        const items = itemsOf<IIokaPackage>(await this.source.get('/esim/packages', { country_code: code, limit: 100, offset: 0 }))

        return items.map(item => iokaPlan(item, code)).filter((plan): plan is IEsimPlan => plan !== null)
      }
      catch {
        return []
      }
    })
  }

  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = await this.cache?.getJson<T>(key)

    if (hit) return hit

    const value = await load()

    await this.cache?.setJson(key, value, IOKA_CATALOG_TTL_MS)

    return value
  }
}
