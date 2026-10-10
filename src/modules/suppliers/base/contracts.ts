import type { Offer } from '~/modules/search/models/Offer'
import type { RouteFacts } from '~/modules/suppliers/dictionary/routes.service'
import type { SearchCriteria, SupplierRef } from '~/modules/search/contracts/search'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */

export type SupplierAccess = 'aggregator' | 'agreed' | 'undocumented'

export interface SupplierCapabilities {
  nativeFilters: Array<keyof import('~/modules/search/contracts/search').SearchFilters>
  pageSize: number
  maxPages: number
  priceCursor: boolean
  maxAdults: number
  maxChildren: number
  currencies: string[]
}

export interface RouteConstraints {
  validCheckIn: { from: string, to: string, blockedWeekdays: number[] } | null
  nights: number[]
  maxAdults: number
  maxChildren: number
}

export class Unsupported {
  constructor(public readonly reason: string) {}
}

export const isUnsupported = (value: unknown): value is Unsupported =>
  value instanceof Unsupported

export interface SupplierPage {
  supplier: SupplierRef
  page: number
  offers: Offer[]
  hasMore: boolean
}

export interface ISupplier {
  readonly ref: SupplierRef
  readonly access: SupplierAccess
  readonly capabilities: SupplierCapabilities

  fetchPage: (criteria: SearchCriteria, page: number, signal?: AbortSignal) => Promise<SupplierPage>

  departures: () => Promise<Array<{ slug: string, label: string, code: string }>>

  destinationsFrom: (departureSlug: string) => Promise<Array<{ slug: string, label: string, code: string }>>

  routeFacts: (departureSlug: string, countrySlug: string) => Promise<RouteFacts | null>

  hotels?: (departureSlug: string, countrySlug: string) => Promise<ISupplierHotel[]>
}

export interface ISupplierHotel {
  code: string
  name: string
  stars: number | null
}

export interface ISupplierTransport {
  fetch: (url: string, init?: { signal?: AbortSignal, headers?: Record<string, string> }) => Promise<string>
}
