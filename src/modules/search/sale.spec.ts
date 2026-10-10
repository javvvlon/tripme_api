import { describe, expect, it } from 'vitest'
import { Offer } from './models/Offer'
import { Availability } from './contracts/search'
import { cheapestOnSale } from './sale'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const offer = (id: string, amount: number, availability: Availability) =>
  new Offer({
    id,
    supplier: { id: 'kompastour', name: 'Kompas Tour' },
    hotelName: 'Hotel',
    hotelStars: 4,
    hotelSupplierCode: '1',
    hotelSlug: null,
    hotelUrl: null,
    bookingUrl: null,
    district: null,
    checkIn: '2026-10-14',
    nights: 7,
    mealCode: null,
    mealName: null,
    roomName: null,
    adults: 2,
    children: 0,
    price: { source: { amount, currency: 'USD' } },
    availability,
    availabilityNote: null,
    flightNote: null,
    refundable: null,
    programme: null,
    fare: null,
  })

describe('stop-sale offers', () => {
  it('never reach the results', () => {
    const result = cheapestOnSale([
      offer('a', 900, Availability.Stopped),
      offer('b', 1000, Availability.Available),
      offer('c', 1100, Availability.OnRequest),
      offer('d', 1200, Availability.Unknown),
    ])

    expect(result.map(o => o.get('id'))).toEqual(['b', 'c', 'd'])
  })

  it('lose to a dearer offer for the same tour that is still on sale', () => {
    const result = cheapestOnSale([
      offer('a', 900, Availability.Stopped),
      offer('a', 1000, Availability.Available),
      offer('a', 1050, Availability.Available),
    ])

    expect(result).toHaveLength(1)
    expect(result[0].sortPrice()).toBe(1000)
  })

  it('leave nothing behind when every offer is stopped', () => {
    expect(cheapestOnSale([offer('a', 900, Availability.Stopped)])).toEqual([])
  })
})
