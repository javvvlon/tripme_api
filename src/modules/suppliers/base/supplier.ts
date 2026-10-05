import { Logger } from '@nestjs/common'
import type { Offer } from '~/modules/search/models/Offer'
import type { RouteFacts } from '~/modules/suppliers/dictionary/routes.service'
import type { SearchCriteria, SupplierRef } from '~/modules/search/contracts/search'
import { Unsupported, isUnsupported } from './contracts'
import type {
  ISupplier,
  ISupplierTransport,
  SupplierAccess,
  SupplierCapabilities,
  SupplierPage,
} from './contracts'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export abstract class BaseSupplier<TQuery, TRow> implements ISupplier {
  abstract readonly ref: SupplierRef
  abstract readonly access: SupplierAccess
  abstract readonly capabilities: SupplierCapabilities

  protected readonly requestDelayMs: number = 2500

  protected readonly logger = new Logger(this.constructor.name)
  private lastRequestAt = 0

  constructor(protected readonly transport: ISupplierTransport) {}

  protected abstract buildQuery(
    criteria: SearchCriteria,
    page: number,
  ): Promise<TQuery | Unsupported>

  protected abstract buildUrl(query: TQuery): string

  protected abstract parse(payload: string): TRow[]

  protected abstract map(row: TRow, criteria: SearchCriteria): Offer | null

  protected async prepare(_rows: TRow[]): Promise<void> {}

  abstract departures(): Promise<Array<{ slug: string, label: string, code: string }>>

  abstract destinationsFrom(
    departureSlug: string,
  ): Promise<Array<{ slug: string, label: string, code: string }>>

  abstract routeFacts(departureSlug: string, countrySlug: string): Promise<RouteFacts | null>

  protected get requestHeaders(): Record<string, string> {
    return {}
  }

  async fetchPage(
    criteria: SearchCriteria,
    page: number,
    signal?: AbortSignal,
  ): Promise<SupplierPage> {
    if (page > this.capabilities.maxPages) {
      return { supplier: this.ref, page, offers: [], hasMore: false }
    }

    const query = await this.buildQuery(criteria, page)

    if (isUnsupported(query)) {
      throw query
    }

    await this.throttle()

    const payload = await this.transport.fetch(this.buildUrl(query), {
      signal,
      headers: this.requestHeaders,
    })

    const rows = this.parse(payload)

    await this.prepare(rows)

    const offers: Offer[] = []
    for (const row of rows) {
      const offer = this.map(row, criteria)
      if (offer) offers.push(offer)
    }

    return {
      supplier: this.ref,
      page,
      offers,
      hasMore: rows.length >= this.capabilities.pageSize,
    }
  }

  private async throttle(): Promise<void> {
    const wait = this.requestDelayMs - (Date.now() - this.lastRequestAt)
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait))
    this.lastRequestAt = Date.now()
  }
}
