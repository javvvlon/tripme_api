import { describe, expect, it } from 'vitest'
import { clockPath, leadTriggerOf, returnDayOf, tashkentDay } from './order-flow'
import { OrderStatus } from './order.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const issued = { status: 'issued', checkIn: '2026-11-02', returnDate: '2026-11-09', nights: 7 }

describe('order clock', () => {
  it('counts the day in Tashkent time', () => {
    expect(tashkentDay(new Date('2026-11-01T18:59:00Z'))).toBe('2026-11-01')
    expect(tashkentDay(new Date('2026-11-01T19:00:00Z'))).toBe('2026-11-02')
  })

  it('takes the return day from the order or from the nights', () => {
    expect(returnDayOf(issued)).toBe('2026-11-09')
    expect(returnDayOf({ ...issued, returnDate: null })).toBe('2026-11-09')
    expect(returnDayOf({ ...issued, returnDate: null, checkIn: '2026-12-28', nights: 5 })).toBe('2027-01-02')
    expect(returnDayOf({ ...issued, returnDate: null, checkIn: null })).toBeNull()
  })

  it('sends an issued order on the trip on the departure day', () => {
    expect(clockPath(issued, '2026-11-01')).toEqual([])
    expect(clockPath(issued, '2026-11-02')).toEqual(['travelling'])
    expect(clockPath(issued, '2026-11-09')).toEqual(['travelling'])
  })

  it('completes the trip the day after the return', () => {
    expect(clockPath({ ...issued, status: 'travelling' }, '2026-11-09')).toEqual([])
    expect(clockPath({ ...issued, status: 'travelling' }, '2026-11-10')).toEqual(['completed'])
    expect(clockPath(issued, '2026-11-12')).toEqual(['travelling', 'completed'])
  })

  it('leaves orders without documents or dates alone', () => {
    expect(clockPath({ ...issued, status: 'confirmed' }, '2026-11-20')).toEqual([])
    expect(clockPath({ ...issued, checkIn: null, returnDate: null }, '2026-11-20')).toEqual([])
    expect(clockPath({ ...issued, status: 'travelling', checkIn: null, returnDate: null }, '2026-11-20')).toEqual([])
    expect(clockPath({ ...issued, status: 'completed' }, '2026-11-20')).toEqual([])
  })
})

describe('order → lead', () => {
  it('maps order moves to lead triggers', () => {
    expect(leadTriggerOf(OrderStatus.Draft)).toBeNull()
    expect(leadTriggerOf(OrderStatus.Requested)).toBe('taken')
    expect(leadTriggerOf(OrderStatus.Confirmed)).toBe('ordered')
    expect(leadTriggerOf(OrderStatus.Completed)).toBe('ordered')
    expect(leadTriggerOf(OrderStatus.Cancelled)).toBe('reopened')
  })
})
