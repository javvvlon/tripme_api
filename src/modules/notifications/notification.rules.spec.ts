import { describe, expect, it } from 'vitest'
import { routeOf, statusMessage, sumText } from './notification.rules'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
describe('notification routing', () => {
  it('prefers the account email, then the phone, then stays quiet', () => {
    const both = { email: 'aziz@example.uz', phone: '+998901234567' }

    expect(routeOf({ ...both, open: { email: true, sms: true } })).toEqual({ channel: 'email', to: 'aziz@example.uz' })
    expect(routeOf({ ...both, open: { email: false, sms: true } })).toEqual({ channel: 'sms', to: '+998901234567' })
    expect(routeOf({ email: null, phone: '+998901234567', open: { email: true, sms: false } })).toBeNull()
  })

  it('only tells the client about statuses that matter to them', () => {
    expect(statusMessage('confirmed')).toBe('order_confirmed')
    expect(statusMessage('requested')).toBeNull()
    expect(sumText(4152900)).toBe('4 152 900 сум')
  })
})
