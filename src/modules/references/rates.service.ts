import { Injectable, Logger } from '@nestjs/common'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IUzsRates {
  base: 'UZS'
  date: string | null
  rates: Record<string, number>
  source: 'cbu' | 'market'
}

const SOURCE = 'https://cbu.uz/ru/arkhiv-kursov-valyut/json/'
const MARKET_SOURCE = 'https://open.er-api.com/v6/latest/USD'
const TTL_MS = 60 * 60 * 1000
const RETRY_MS = 10 * 60 * 1000
const TIMEOUT_MS = 8000
const WANTED = ['USD', 'EUR', 'RUB']

interface ICbuRow {
  Ccy: string
  Rate: string
  Nominal: string
  Date: string
}

interface IMarketPayload {
  result?: string
  time_last_update_unix?: number
  rates?: Record<string, number>
}

const empty = (source: IUzsRates['source']): IUzsRates => ({ base: 'UZS', date: null, rates: {}, source })

export function marketRates(payload: IMarketPayload): IUzsRates {
  const perUsd = payload.rates ?? {}
  const uzs = perUsd.UZS
  const rates: Record<string, number> = {}

  if (payload.result !== 'success' || !uzs || !Number.isFinite(uzs) || uzs <= 0) return empty('market')

  for (const currency of WANTED) {
    const units = currency === 'USD' ? 1 : perUsd[currency]

    if (units && Number.isFinite(units) && units > 0) rates[currency] = Math.round(uzs / units * 100) / 100
  }

  const date = payload.time_last_update_unix ? new Date(payload.time_last_update_unix * 1000).toISOString().slice(0, 10) : null

  return { base: 'UZS', date, rates, source: 'market' }
}

@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name)
  private cached: { at: number, value: IUzsRates } | null = null
  private loading: Promise<IUzsRates> | null = null
  private failedAt = 0
  private market: { at: number, value: IUzsRates } | null = null
  private marketLoading: Promise<IUzsRates> | null = null
  private readonly history = new Map<string, IUzsRates>()

  async current(): Promise<IUzsRates> {
    if (this.cached && Date.now() - this.cached.at < TTL_MS) return this.cached.value

    if (this.resting()) return this.cached?.value ?? empty('cbu')

    this.loading ??= this.load().finally(() => { this.loading = null })

    return this.loading
  }

  async display(): Promise<IUzsRates> {
    const official = await this.current()

    if (official.rates.USD) return official

    if (this.market && Date.now() - this.market.at < (this.market.value.rates.USD ? TTL_MS : RETRY_MS)) return this.market.value

    this.marketLoading ??= this.loadMarket().finally(() => { this.marketLoading = null })

    return this.marketLoading
  }

  async on(day: string): Promise<IUzsRates | null> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null

    const known = this.history.get(day)

    if (known) return known

    if (this.resting()) return null

    try {
      const value = await this.fetchRates(`${SOURCE}all/${day}/`)

      if (this.history.size > 400) this.history.clear()
      this.history.set(day, value)

      return value
    }
    catch (error) {
      this.failedAt = Date.now()
      this.logger.warn(`rates for ${day} unavailable: ${String(error)}`)

      return null
    }
  }

  private resting(): boolean {
    return this.failedAt > 0 && Date.now() - this.failedAt < RETRY_MS
  }

  private async fetchRates(url: string): Promise<IUzsRates> {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!response.ok) throw new Error(`cbu answered ${response.status}`)

    const rows = await response.json() as ICbuRow[]
    const rates: Record<string, number> = {}
    let date: string | null = null

    for (const row of rows) {
      if (!WANTED.includes(row.Ccy)) continue

      const rate = Number(row.Rate) / (Number(row.Nominal) || 1)
      if (Number.isFinite(rate) && rate > 0) rates[row.Ccy] = rate

      const [day, month, year] = row.Date.split('.')
      if (day && month && year) date = `${year}-${month}-${day}`
    }

    if (!rates.USD) throw new Error('cbu returned no USD rate')

    return { base: 'UZS', date, rates, source: 'cbu' }
  }

  private async load(): Promise<IUzsRates> {
    try {
      const value = await this.fetchRates(SOURCE)

      this.cached = { at: Date.now(), value }
      this.failedAt = 0

      return value
    }
    catch (error) {
      this.failedAt = Date.now()
      this.logger.warn(`rates refresh failed: ${String(error)}`)

      return this.cached?.value ?? empty('cbu')
    }
  }

  private async loadMarket(): Promise<IUzsRates> {
    try {
      const response = await fetch(MARKET_SOURCE, { signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (!response.ok) throw new Error(`market rates answered ${response.status}`)

      const value = marketRates(await response.json() as IMarketPayload)

      this.market = { at: Date.now(), value }

      return value
    }
    catch (error) {
      this.logger.warn(`market rates unavailable: ${String(error)}`)
      this.market = { at: Date.now(), value: empty('market') }

      return this.market.value
    }
  }
}
