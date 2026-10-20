import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_HOT_DAYS, daysUntil, hotDays, isHotDeparture, tashkentToday } from './hot'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
describe('«горящий» tours', () => {
  afterEach(() => { delete process.env.HOT_DAYS })

  it('counts whole days to departure', () => {
    expect(daysUntil('2026-10-30', '2026-10-20')).toBe(10)
    expect(daysUntil('2026-10-20', '2026-10-20')).toBe(0)
  })

  it('is hot from today up to ten days ahead', () => {
    expect(isHotDeparture('2026-10-20', false, '2026-10-20')).toBe(true)
    expect(isHotDeparture('2026-10-30', false, '2026-10-20')).toBe(true)
    expect(isHotDeparture('2026-10-31', false, '2026-10-20')).toBe(false)
    expect(isHotDeparture('2026-10-19', false, '2026-10-20')).toBe(false)
  })

  it('never calls a stop-sale tour hot', () => {
    expect(isHotDeparture('2026-10-22', true, '2026-10-20')).toBe(false)
  })

  it('takes the window from HOT_DAYS when it is sane', () => {
    process.env.HOT_DAYS = '14'
    expect(hotDays()).toBe(14)
    process.env.HOT_DAYS = 'soon'
    expect(hotDays()).toBe(DEFAULT_HOT_DAYS)
  })

  it('uses the Tashkent date, not UTC', () => {
    expect(tashkentToday(new Date('2026-10-20T20:30:00Z'))).toBe('2026-10-21')
  })
})
