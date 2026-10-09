import { describe, expect, it } from 'vitest'
import { phoneKey } from './phone'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
describe('phone key', () => {
  it('reads every way a Tashkent number gets written as one key', () => {
    for (const raw of ['+998 90 123-45-67', '998901234567', '(90) 123-45-67', '901234567']) {
      expect(phoneKey(raw), raw).toBe('998901234567')
    }
  })

  it('refuses something too short to be a phone', () => {
    expect(phoneKey('12345')).toBe('')
    expect(phoneKey(null)).toBe('')
  })
})
