import { createHash } from 'node:crypto'
import type { SearchCriteria } from './contracts/search'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const SEARCH_CACHE_TTL_MS = 12 * 60 * 1000

export const SEARCH_FAILURE_TTL_MS = 2 * 60 * 1000

export const failureKey = (resultKey: string): string => resultKey.replace(/^search:/, 'search-failed:')

export function searchCacheKey(supplierId: string, criteria: SearchCriteria, page: number): string {
  const sent = {
    from: criteria.from,
    to: criteria.to,
    dateFrom: criteria.dateFrom,
    dateTo: criteria.dateTo,
    nightsFrom: criteria.nightsFrom,
    nightsTo: criteria.nightsTo,
    adults: criteria.adults,
    childrenAges: [...criteria.childrenAges].sort((a, b) => a - b),
    currency: criteria.currency,
    hotels: [...criteria.filters.hotels].sort(),
    priceMin: criteria.filters.priceMin ?? null,
    priceMax: criteria.filters.priceMax ?? null,
    ...(criteria.filters.areas?.length ? { areas: [...criteria.filters.areas].sort() } : {}),
  }

  const digest = createHash('sha1').update(JSON.stringify(sent)).digest('hex')

  return `search:v1:${supplierId}:${digest}:${page}`
}
