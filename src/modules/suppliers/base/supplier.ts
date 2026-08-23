import { Logger } from '@nestjs/common'
import type { Offer } from '~/modules/search/models/Offer'
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
 * The pipeline every supplier runs, and the cross-cutting concerns none of
 * them should reimplement: paging, rate limiting, dedupe, cancellation and
 * the short-page stop condition.
 *
 * Subclasses supply four steps. Keeping them separate is not ceremony — the
 * parser is the fragile one (it reads someone else's markup), and isolating it
 * means a supplier's redesign breaks one file with one failing fixture test,
 * rather than a method that also owns HTTP and paging.
 *
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export abstract class BaseSupplier<TQuery, TRow> implements ISupplier {
  abstract readonly ref: SupplierRef
  abstract readonly access: SupplierAccess
  abstract readonly capabilities: SupplierCapabilities

  /** milliseconds between requests — politeness, and how not to get IP-banned */
  protected readonly requestDelayMs: number = 2500

  protected readonly logger = new Logger(this.constructor.name)
  private lastRequestAt = 0

  constructor(protected readonly transport: ISupplierTransport) {}

  /** ours → theirs. Returns Unsupported when this supplier cannot serve it. */
  protected abstract buildQuery(criteria: SearchCriteria, page: number): TQuery | Unsupported

  protected abstract buildUrl(query: TQuery): string

  /** their payload → their rows. The fragile step; keep it pure. */
  protected abstract parse(payload: string): TRow[]

  /** their row → our Offer. */
  protected abstract map(row: TRow, criteria: SearchCriteria): Offer | null

  /**
   * Headers the supplier's endpoint expects. Overridden per protocol, because
   * "what does this host want to see" is a property of the host, not of the
   * transport.
   */
  protected get requestHeaders(): Record<string, string> {
    return {}
  }

  /**
   * Fetch exactly one page.
   *
   * Demand-driven on purpose. Walking the whole listing costs ten requests and
   * ~27s at the polite interval, and almost nobody reads past the first page —
   * it is already the cheapest hundred, sorted by price. So the agent's scroll
   * decides how deep we go, and a supplier only sees the requests a human
   * actually caused.
   */
  async fetchPage(
    criteria: SearchCriteria,
    page: number,
    signal?: AbortSignal,
  ): Promise<SupplierPage> {
    if (page > this.capabilities.maxPages) {
      return { supplier: this.ref, page, offers: [], hasMore: false }
    }

    const query = this.buildQuery(criteria, page)

    if (isUnsupported(query)) {
      // Thrown rather than returned empty: an unservable search is not an
      // empty page, and the caller must tell them apart. A supplier that was
      // never properly asked looks identical to one with no availability, and
      // that difference is the point of §4's "who answered" row.
      throw query
    }

    await this.throttle()

    const payload = await this.transport.fetch(this.buildUrl(query), {
      signal,
      headers: this.requestHeaders,
    })

    const rows = this.parse(payload)

    const offers: Offer[] = []
    for (const row of rows) {
      const offer = this.map(row, criteria)
      if (offer) offers.push(offer)
    }

    // The only end-of-listing signal SAMO gives is a short page: no total, no
    // next link, and a full page is indistinguishable from the last one except
    // by its length.
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
