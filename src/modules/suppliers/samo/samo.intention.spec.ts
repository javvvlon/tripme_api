import { describe, expect, it } from 'vitest'
import { SamoSearchIntention } from './samo.intention'
import type { SearchCriteria } from '~/modules/search/contracts/search'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const criteria = (priceMin?: number, priceMax?: number): SearchCriteria => ({
  from: 'tashkent',
  to: 'turkey',
  dateFrom: '2026-12-01',
  dateTo: '2026-12-03',
  nightsFrom: 7,
  nightsTo: 7,
  adults: 2,
  childrenAges: [],
  currency: 'USD',
  filters: { stars: [], meals: [], resorts: [], hotels: [], suppliers: [], priceMin, priceMax },
})

const request = (rate: number | null, priceMin?: number, priceMax?: number) =>
  new SamoSearchIntention({ townFrom: '1', state: '2' }, 1, {}, rate).toRequest(criteria(priceMin, priceMax)) as Record<string, string>

describe('samo search request', () => {
  it('sends the sum range to the operator in its own currency at its own rate', () => {
    const params = request(12_100, 10_000_000, 12_000_000)

    expect([params.COSTMIN, params.COSTMAX]).toEqual(['826', '992'])
  })

  it('sends no price bounds without the operator rate, so the range is applied on our side', () => {
    const params = request(null, 10_000_000, 12_000_000)

    expect(params.COSTMIN).toBeUndefined()
    expect(params.COSTMAX).toBeUndefined()
  })
})
