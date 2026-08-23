import type { Offer } from '~/modules/search/models/Offer'
import type { SearchCriteria, SupplierRef } from '~/modules/search/contracts/search'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */

/**
 * How we relate to this supplier — an operational fact, not a legal one.
 *
 * It answers "who do I call when this breaks?": an `aggregator` gets a support
 * ticket, an `agreed` partner gets an email to the account manager, and an
 * `undocumented` endpoint gets discovered at 9am on a Monday when the parser
 * goes quiet. That difference drives alerting and on-call expectations.
 */
export type SupplierAccess = 'aggregator' | 'agreed' | 'undocumented'

/**
 * What a supplier can and cannot do. Declared, not assumed.
 *
 * `nativeFilters` is the load-bearing one. SAMO returns 100 rows per page
 * sorted by price ascending, so filtering *after* the fetch silently filters
 * the hundred cheapest — the expensive hotels never arrived. A filter this
 * supplier cannot express natively must therefore either be pushed into the
 * query or reported as unsupported. It must never be applied locally and
 * presented as complete.
 */
export interface SupplierCapabilities {
  nativeFilters: Array<keyof import('~/modules/search/contracts/search').SearchFilters>
  pageSize: number
  maxPages: number
  /** can we resume from "price >= last seen" instead of paging by index? */
  priceCursor: boolean
  maxAdults: number
  maxChildren: number
  currencies: string[]
}

/** Constraints that depend on the route, not on the supplier as a whole. */
export interface RouteConstraints {
  /** ISO dates the supplier will accept as check-in */
  validCheckIn: { from: string, to: string, blockedWeekdays: number[] } | null
  /** discrete list — SAMO offers 4,5,6,7,8,10,… with 9 genuinely absent */
  nights: number[]
  maxAdults: number
  maxChildren: number
}

/** A supplier declining a search, with a reason an agent can read. */
export class Unsupported {
  constructor(public readonly reason: string) {}
}

export const isUnsupported = (value: unknown): value is Unsupported =>
  value instanceof Unsupported

/** One page of results as it arrives — searches stream, they do not batch. */
export interface SupplierPage {
  supplier: SupplierRef
  page: number
  offers: Offer[]
  /** false when this page was short, i.e. the listing is exhausted */
  hasMore: boolean
}

export interface ISupplier {
  readonly ref: SupplierRef
  readonly access: SupplierAccess
  readonly capabilities: SupplierCapabilities

  /** One page, fetched when someone asks for it. */
  fetchPage: (criteria: SearchCriteria, page: number, signal?: AbortSignal) => Promise<SupplierPage>
}

/**
 * Transport is a seam so the whole pipeline can run against saved fixtures.
 * That is not only for tests: the first milestone (§8 stage 1) is the system
 * working end to end on «условных поставщиках», before anyone has agreed to
 * give us live access.
 */
export interface ISupplierTransport {
  fetch: (url: string, init?: { signal?: AbortSignal, headers?: Record<string, string> }) => Promise<string>
}
