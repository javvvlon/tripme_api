import type { CurrencyCode, Money } from '~/shared/contracts/data'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface SearchCriteria {
  from: string
  to: string
  dateFrom: string
  dateTo: string
  nightsFrom: number
  nightsTo: number
  adults: number
  childrenAges: number[]
  currency: CurrencyCode
  filters: SearchFilters
}

export interface SearchFilters {
  stars: number[]
  meals: string[]
  resorts: string[]
  hotels: string[]
  priceMin?: number
  priceMax?: number
  suppliers: string[]
}

export enum Availability {
  Available = 'available',
  OnRequest = 'on_request',
  Stopped = 'stopped',
  Unknown = 'unknown',
}

export interface SupplierRef {
  id: string
  name: string
}

export enum SupplierState {
  Pending = 'pending',
  Searching = 'searching',
  Done = 'done',
  Failed = 'failed',
  Unsupported = 'unsupported',
}

export interface SupplierStatus {
  supplier: SupplierRef
  state: SupplierState
  offers: number
  reason?: string
  tookMs?: number
}

export interface SearchEvent {
  searchId: string
  type: 'status' | 'offers' | 'done'
  statuses: SupplierStatus[]
  offers?: unknown[]
}

export interface PriceBreakdown {
  source: Money
  converted?: Money
}

export type { Money, CurrencyCode }
