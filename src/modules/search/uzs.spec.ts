import { describe, expect, it } from 'vitest'
import { uzsByCbu, uzsByOperator } from './uzs'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
describe('uzs prices', () => {
  it('uses the operator rate as it is, rounded to a thousand sum', () => {
    expect(uzsByOperator(1166, 12040)).toEqual({ amount: 14_039_000, currency: 'UZS', basis: 'operator', rate: 12040 })
  })

  it('adds the 1.5% buffer on top of the central bank rate', () => {
    expect(uzsByCbu(1000, 12000)).toEqual({ amount: 12_180_000, currency: 'UZS', basis: 'cbu', rate: 12180 })
  })

  it('gives nothing without a usable rate', () => {
    expect(uzsByOperator(1000, null)).toBeNull()
    expect(uzsByOperator(1000, 0)).toBeNull()
    expect(uzsByCbu(1000, undefined)).toBeNull()
  })
})
