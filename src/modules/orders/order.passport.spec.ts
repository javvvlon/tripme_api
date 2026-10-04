import { describe, expect, it } from 'vitest'
import { passportProblem, tripEnd } from './orders.service'
import { LEAD_PREFIX, ORDER_PREFIX, numberFromReference, reference } from '~/shared/helpers/reference'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const order = (over: Partial<Parameters<typeof passportProblem>[0]> = {}) => ({
  checkIn: '2026-11-10',
  nights: 7,
  returnDate: null,
  passportExpiresAt: null,
  ...over,
})

describe('passport rule', () => {
  it('ends the trip on the return date, or check-in plus nights', () => {
    expect(tripEnd(order())).toBe('2026-11-17')
    expect(tripEnd(order({ returnDate: '2026-11-18' }))).toBe('2026-11-18')
  })

  it('wants six months of validity after the trip ends', () => {
    expect(passportProblem(order({ passportExpiresAt: '2027-05-17' }))).toBeNull()
    expect(passportProblem(order({ passportExpiresAt: '2027-05-16' }))).toBe('short')
    expect(passportProblem(order({ passportExpiresAt: '2026-11-17' }))).toBe('expired')
  })

  it('leaves a booking alone until a passport is entered', () => {
    expect(passportProblem(order())).toBeNull()
  })
})

describe('references', () => {
  it('reads like LD-2026-0323 and ORD-2026-0087', () => {
    expect(reference(LEAD_PREFIX, 323, '2026-03-01T10:00:00Z')).toBe('LD-2026-0323')
    expect(reference(ORDER_PREFIX, 87, new Date('2026-10-04T00:00:00Z'))).toBe('ORD-2026-0087')
    expect(reference(ORDER_PREFIX, 12345, '2026-10-04T00:00:00Z')).toBe('ORD-2026-12345')
  })

  it('finds the number behind a typed reference', () => {
    expect(numberFromReference('ld-2026-0323', LEAD_PREFIX)).toBe(323)
    expect(numberFromReference(' ORD-2026-0087 ', ORDER_PREFIX)).toBe(87)
    expect(numberFromReference('Rixos', ORDER_PREFIX)).toBeNull()
  })
})
