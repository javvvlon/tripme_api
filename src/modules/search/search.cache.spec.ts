import { describe, expect, it } from 'vitest'
import { searchCacheKey } from './search.cache'
import type { SearchCriteria } from './contracts/search'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const base: SearchCriteria = {
  from: 'tashkent',
  to: 'turkey',
  dateFrom: '2026-11-01',
  dateTo: '2026-11-07',
  nightsFrom: 6,
  nightsTo: 8,
  adults: 2,
  childrenAges: [7, 3],
  currency: 'USD',
  filters: { stars: [], meals: [], resorts: [], hotels: [], suppliers: [] },
}

describe('searchCacheKey', () => {
  it('ignores filters applied after the operator answers', () => {
    const filtered = { ...base, filters: { ...base.filters, stars: [5], meals: ['AI'], resorts: ['kemer'], suppliers: ['kompastour'] } }

    expect(searchCacheKey('kompastour', filtered, 1)).toBe(searchCacheKey('kompastour', base, 1))
  })

  it('does not depend on the order of children ages or hotels', () => {
    const shuffled = { ...base, childrenAges: [3, 7], filters: { ...base.filters, hotels: ['b', 'a'] } }
    const sorted = { ...base, filters: { ...base.filters, hotels: ['a', 'b'] } }

    expect(searchCacheKey('x', shuffled, 1)).toBe(searchCacheKey('x', sorted, 1))
  })

  it('separates operators, pages and anything sent to the operator', () => {
    const key = searchCacheKey('kompastour', base, 1)

    expect(searchCacheKey('prestige', base, 1)).not.toBe(key)
    expect(searchCacheKey('kompastour', base, 2)).not.toBe(key)
    expect(searchCacheKey('kompastour', { ...base, adults: 3 }, 1)).not.toBe(key)
    expect(searchCacheKey('kompastour', { ...base, filters: { ...base.filters, priceMax: 1500 } }, 1)).not.toBe(key)
  })
})
