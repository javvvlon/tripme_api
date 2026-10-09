import { describe, expect, it } from 'vitest'
import { activeLocalFacets, localFilter } from './local-filters'
import { buildFacets } from './facets'
import type { Offer } from './models/Offer'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const offer = (stars: number, district: string, meal: string, price = 1000): Offer => {
  const data: Record<string, unknown> = {
    hotelStars: stars,
    district,
    mealCode: meal,
    mealName: meal,
    supplier: { id: 's1', name: 'Kompas' },
    availability: 'available',
    price: { source: { amount: price, currency: 'USD' }, converted: null },
  }

  return { get: (key: string) => data[key], sortPrice: () => price, toObject: () => data } as unknown as Offer
}

const offers = [
  offer(3, 'Султанахмет', 'RO'),
  offer(3, 'Фатих', 'BB'),
  offer(4, 'Султанахмет', 'Bed & Breakfast'),
  offer(5, 'Таксим', 'AI'),
  offer(4, 'Таксим', 'ROOM ONLY'),
]

const none = new Set<string>()

describe('local filters', () => {
  it('keeps offers matching every active filter', () => {
    const kept = localFilter(offers, { stars: [3, 4], meals: ['RO'], resorts: [] }, none)

    expect(kept.map(o => `${o.get('hotelStars')} ${o.get('mealCode')}`)).toEqual(['3 RO', '4 ROOM ONLY'])
  })

  it('leaves out a filter the operators already applied', () => {
    expect(activeLocalFacets({ stars: [3], meals: ['BB'] }, new Set(['stars']))).toEqual(['meals'])
  })

  it('counts each group without its own filter, so siblings stay pickable', () => {
    const filters = { stars: [3], meals: ['RO'], resorts: [] }
    const facets = buildFacets(localFilter(offers, filters, none), 100, {
      stars: localFilter(offers, filters, none, 'stars'),
      meals: localFilter(offers, filters, none, 'meals'),
      districts: localFilter(offers, filters, none, 'resorts'),
    })

    expect(facets.stars.map(o => `${o.value}:${o.count}`)).toEqual(['4:1', '3:1'])
    expect(facets.meals.map(o => `${o.value}:${o.count}`)).toEqual(['RO:1', 'BB:1'])
    expect(facets.districts.map(o => o.value)).toEqual(['Султанахмет'])
    expect(facets.total).toBe(1)
  })
})
