import { Injectable, Logger } from '@nestjs/common'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IUzsRates {
  base: 'UZS'
  date: string | null
  rates: Record<string, number>
  source: 'cbu'
}

const SOURCE = 'https://cbu.uz/ru/arkhiv-kursov-valyut/json/'
const TTL_MS = 60 * 60 * 1000
const WANTED = ['USD', 'EUR', 'RUB']

interface ICbuRow {
  Ccy: string
  Rate: string
  Nominal: string
  Date: string
}

@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name)
  private cached: { at: number, value: IUzsRates } | null = null
  private loading: Promise<IUzsRates> | null = null
  private readonly history = new Map<string, IUzsRates>()

  async current(): Promise<IUzsRates> {
    if (this.cached && Date.now() - this.cached.at < TTL_MS) return this.cached.value

    this.loading ??= this.load().finally(() => { this.loading = null })

    return this.loading
  }

  async on(day: string): Promise<IUzsRates | null> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null

    const known = this.history.get(day)

    if (known) return known

    try {
      const value = await this.fetchRates(`${SOURCE}all/${day}/`)

      if (this.history.size > 400) this.history.clear()
      this.history.set(day, value)

      return value
    }
    catch (error) {
      this.logger.warn(`rates for ${day} unavailable: ${String(error)}`)

      return null
    }
  }

  private async fetchRates(url: string): Promise<IUzsRates> {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
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

      return value
    }
    catch (error) {
      this.logger.warn(`rates refresh failed: ${String(error)}`)

      if (this.cached) return this.cached.value

      return { base: 'UZS', date: null, rates: {}, source: 'cbu' }
    }
  }
}
