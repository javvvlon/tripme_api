import { describe, expect, it } from 'vitest'
import { Availability } from './contracts/search'
import type { IOffer } from './models/Offer'
import { byTheme, countriesOf, discountOf, entryOf, offerFor, showcaseWindow, themeOf } from './showcase'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const offer = (id: string, amount: number, oldPrice: number | null = null, availability = Availability.Available): IOffer => ({
  id,
  supplier: { id: 'kompastour', name: 'Kompas Tour' },
  hotelName: id,
  hotelStars: 4,
  hotelSupplierCode: id,
  hotelSlug: null,
  hotelUrl: null,
  bookingUrl: null,
  district: null,
  checkIn: '2026-11-03',
  nights: 7,
  mealCode: null,
  mealName: null,
  roomName: null,
  adults: 2,
  children: 0,
  price: { source: { amount, currency: 'USD' }, uzs: { amount: amount * 12000, rate: 12000, basis: 'cbu' } },
  availability,
  availabilityNote: null,
  flightNote: null,
  refundable: null,
  programme: null,
  fare: null,
  oldPrice,
} as IOffer)

const countries = ['egypt', 'turkey', 'georgia', 'china', 'maldives'].map(slug => ({ slug, label: slug, code: slug }))

describe('showcase', () => {
  it('reads unknown themes as the full showcase', () => {
    expect(themeOf('beach')).toBe('beach')
    expect(themeOf('weird')).toBe('all')
    expect(themeOf(undefined)).toBe('all')
  })

  it('searches a week ahead for five days unless dates are given, never today', () => {
    expect(showcaseWindow('2026-10-27')).toEqual({ dateFrom: '2026-11-03', dateTo: '2026-11-08' })
    expect(showcaseWindow('2026-10-27', '2026-12-28', '2026-12-31')).toEqual({ dateFrom: '2026-12-28', dateTo: '2026-12-31' })
    expect(showcaseWindow('2026-10-27', '2026-10-27').dateFrom).toBe('2026-11-03')
    expect(showcaseWindow('2026-10-27', '2026-12-01', '2027-01-10').dateTo).toBe('2026-12-08')
  })

  it('keeps only the theme countries the departure city flies to', () => {
    expect(countriesOf(countries, 'beach').map(country => country.slug)).toEqual(['egypt', 'turkey', 'maldives'])
    expect(countriesOf(countries, 'history').map(country => country.slug)).toEqual(['egypt', 'turkey', 'georgia'])
    expect(countriesOf(countries, 'kids')).toHaveLength(5)
  })

  it('measures a real discount from the operator old price only', () => {
    expect(discountOf(offer('a', 800, 1000))).toBe(20)
    expect(discountOf(offer('b', 800))).toBe(0)
    expect(discountOf(offer('c', 800, 700))).toBe(0)
  })

  it('picks the cheapest offer on sale and the deepest operator discount per country', () => {
    const entry = entryOf([offer('stop', 300, null, Availability.Stopped), offer('cheap', 500), offer('deal', 900, 1500), offer('small', 600, 650)])

    expect(entry.cheapest?.id).toBe('cheap')
    expect(entry.deal?.id).toBe('deal')
    expect(entry.saving).toBe(40)
    expect(entry.savingKind).toBe('old_price')
    expect(entry.offers).toBe(3)
    expect(offerFor(entry, 'discount')?.id).toBe('deal')
    expect(offerFor(entry, 'beach')?.id).toBe('cheap')
  })

  it('counts a tour at least 12% under its star category median per night as a deal', () => {
    const usual = [1000, 1000, 1000, 1000, 1000, 1000].map((amount, index) => offer(`u${index}`, amount))
    const entry = entryOf([...usual, offer('bargain', 850), offer('slight', 950)])

    expect(entry.deal?.id).toBe('bargain')
    expect(entry.saving).toBe(15)
    expect(entry.savingKind).toBe('median')
    expect(entryOf(usual).deal).toBeNull()
  })

  it('compares per night and ignores offers without a star category', () => {
    const usual = [1000, 1000, 1000, 1000, 1000].map((amount, index) => offer(`u${index}`, amount))
    const longer = { ...offer('long', 1100), nights: 10 }
    const unrated = [300, 900, 900, 900, 900, 900].map((amount, index) => ({ ...offer(`n${index}`, amount), hotelStars: null }))

    expect(entryOf([...usual, longer]).deal?.id).toBe('long')
    expect(entryOf([...usual, ...unrated]).deal).toBeNull()
  })

  it('orders cards by price, or by saving for the sale preset, and drops empty ones', () => {
    const cards = [
      { name: 'empty', offer: null, discount: 0 },
      { name: 'dear', offer: offer('x', 900, 1000), discount: 30 },
      { name: 'cheap', offer: offer('y', 400, 420), discount: 5 },
    ]

    expect(byTheme(cards, 'all').map(card => card.name)).toEqual(['cheap', 'dear'])
    expect(byTheme(cards, 'discount').map(card => card.name)).toEqual(['dear', 'cheap'])
  })
})
