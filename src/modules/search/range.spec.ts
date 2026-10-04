import { describe, expect, it } from 'vitest'
import { Offer } from './models/Offer'
import { Availability } from './contracts/search'
import { cheapestByDay } from './facets'
import { toCriteria } from './search.query'
import type { IOffer } from './models/Offer'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const offer = (checkIn: string, source: IOffer['price']['source'], converted?: IOffer['price']['source']) =>
  new Offer({
    id: `${checkIn}:${source.amount}`,
    supplier: { id: 'kompastour', name: 'Kompas Tour' },
    hotelName: 'Hotel',
    hotelStars: 4,
    hotelSupplierCode: '1',
    hotelSlug: null,
    hotelUrl: null,
    bookingUrl: null,
    district: null,
    checkIn,
    nights: 7,
    mealCode: null,
    mealName: null,
    roomName: null,
    adults: 2,
    children: 0,
    price: { source, converted },
    availability: Availability.Available,
    availabilityNote: null,
    flightNote: null,
    refundable: null,
    programme: null,
    fare: null,
  })

describe('date range search', () => {
  const query = { from: 'tashkent', to: 'turkey', date: '2026-10-13' }

  it('caps the range at a week after the first day', () => {
    expect(toCriteria({ ...query, dateTo: '2026-10-30' }).dateTo).toBe('2026-10-20')
    expect(toCriteria({ ...query, dateTo: '2026-10-16' }).dateTo).toBe('2026-10-16')
  })

  it('falls back to a single day for a missing or backwards range', () => {
    expect(toCriteria(query).dateTo).toBe('2026-10-13')
    expect(toCriteria({ ...query, dateTo: '2026-10-01' }).dateTo).toBe('2026-10-13')
  })

  it('picks the cheapest offer of each day in one currency', () => {
    const days = cheapestByDay([
      offer('2026-10-14', { amount: 1000, currency: 'EUR' }, { amount: 1170, currency: 'USD' }),
      offer('2026-10-14', { amount: 1100, currency: 'USD' }),
      offer('2026-10-13', { amount: 990, currency: 'USD' }),
    ])

    expect(days).toEqual([
      { date: '2026-10-13', price: { amount: 990, currency: 'USD' }, count: 1 },
      { date: '2026-10-14', price: { amount: 1100, currency: 'USD' }, count: 2 },
    ])
  })
})
