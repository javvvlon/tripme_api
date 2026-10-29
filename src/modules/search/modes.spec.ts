import { describe, expect, it } from 'vitest'
import { EXCURSION_NIGHTS, toCriteria } from './search.query'
import { searchCacheKey } from './search.cache'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const base = { from: 'tashkent', to: 'turkey', date: '2026-11-15', nights: '7' }

describe('search modes', () => {
  it('keeps tour criteria exactly as before', () => {
    const criteria = toCriteria(base)

    expect(criteria).not.toHaveProperty('mode')
    expect(criteria.from).toBe('tashkent')
    expect(toCriteria({ ...base, mode: 'tours' })).toEqual(criteria)
    expect(toCriteria({ ...base, mode: 'flights' })).toEqual(criteria)
  })

  it('still needs a departure for tours only', () => {
    expect(() => toCriteria({ ...base, from: undefined })).toThrow('from is required')
    expect(toCriteria({ ...base, from: undefined, mode: 'hotels' }).from).toBe('')
    expect(toCriteria({ ...base, from: undefined, mode: 'excursions' }).from).toBe('')
  })

  it('drops the departure for hotels and opens nights for excursions', () => {
    expect(toCriteria({ ...base, mode: 'hotels' })).toMatchObject({ mode: 'hotels', from: '', nightsFrom: 7, nightsTo: 7 })
    expect(toCriteria({ ...base, mode: 'excursions' })).toMatchObject({
      mode: 'excursions',
      from: 'tashkent',
      nightsFrom: EXCURSION_NIGHTS.from,
      nightsTo: EXCURSION_NIGHTS.to,
    })
  })

  it('keeps tour cache keys and separates the modes', () => {
    const tours = toCriteria(base)
    const hotels = toCriteria({ ...base, mode: 'hotels' })

    expect(searchCacheKey('kompastour', tours, 1)).toBe(searchCacheKey('kompastour', { ...tours, mode: 'tours' }, 1))
    expect(searchCacheKey('kompastour', hotels, 1)).not.toBe(searchCacheKey('kompastour', { ...hotels, mode: 'excursions' }, 1))
    expect(searchCacheKey('kompastour', hotels, 1)).not.toBe(searchCacheKey('kompastour', { ...tours, from: '' }, 1))
  })
})
