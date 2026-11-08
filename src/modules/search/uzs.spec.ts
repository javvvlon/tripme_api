import { describe, expect, it } from 'vitest'
import { inUzsRange, nativePriceBounds, uzsAmountOf, uzsByCbu, uzsByOperator } from './uzs'
import type { Offer } from './models/Offer'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
describe('uzs prices', () => {
  it('uses the operator rate as it is, rounded to a thousand sum', () => {
    expect(uzsByOperator(1166, 12040)).toEqual({ amount: 14_039_000, currency: 'UZS', basis: 'operator', rate: 12040 })
  })

  it('adds the 2% buffer on top of the central bank rate', () => {
    expect(uzsByCbu(1000, 12000)).toEqual({ amount: 12_240_000, currency: 'UZS', basis: 'cbu', rate: 12240 })
  })

  it('gives nothing without a usable rate', () => {
    expect(uzsByOperator(1000, null)).toBeNull()
    expect(uzsByOperator(1000, 0)).toBeNull()
    expect(uzsByCbu(1000, undefined)).toBeNull()
  })
})

const priced = (price: Record<string, unknown>): Offer => ({ get: (key: string) => (key === 'price' ? price : undefined) }) as unknown as Offer

describe('price filter in sums', () => {
  it('reads the sum price the card shows, or a price already in sums', () => {
    expect(uzsAmountOf(priced({ source: { amount: 905, currency: 'USD' }, uzs: { amount: 10_969_000 } }))).toBe(10_969_000)
    expect(uzsAmountOf(priced({ source: { amount: 7_500_000, currency: 'UZS' } }))).toBe(7_500_000)
    expect(uzsAmountOf(priced({ source: { amount: 905, currency: 'USD' } }))).toBeNull()
  })

  it('keeps both edges of the range and drops prices it cannot show in sums', () => {
    expect(inUzsRange(10_000_000, 10_000_000, 12_000_000)).toBe(true)
    expect(inUzsRange(12_000_000, 10_000_000, 12_000_000)).toBe(true)
    expect(inUzsRange(12_001_000, 10_000_000, 12_000_000)).toBe(false)
    expect(inUzsRange(9_999_000, 10_000_000)).toBe(false)
    expect(inUzsRange(null, 10_000_000)).toBe(false)
    expect(inUzsRange(null)).toBe(true)
  })

  it('widens the operator bounds a little so rounding to a thousand sum loses no offer', () => {
    expect(nativePriceBounds(10_000_000, 12_000_000, 12_100)).toEqual({ min: 826, max: 992 })
    expect(nativePriceBounds(undefined, 12_000_000, 12_100)).toEqual({ max: 992 })
    expect(nativePriceBounds(500, undefined, 12_100)).toEqual({ min: 0 })
    expect(nativePriceBounds(10_000_000, 12_000_000, null)).toEqual({})
  })
})
