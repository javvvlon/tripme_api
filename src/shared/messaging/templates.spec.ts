import { describe, expect, it } from 'vitest'
import { messageText, threadText } from './templates'
import { LogMessenger } from './log.messenger'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
describe('messages', () => {
  it('fills the template in the client language', () => {
    expect(messageText('order_confirmed', 'uz', { ref: 'ORD-2026-1002', link: 'https://tripme.uz/x' })).toEqual({
      subject: 'ORD-2026-1002 buyurtma tasdiqlandi',
      text: 'Turoperator ORD-2026-1002 bronni tasdiqladi. Batafsil: https://tripme.uz/x',
    })
  })

  it('drops the link sentence for messages shown inside the account', () => {
    expect(threadText('order_confirmed', 'ru', { ref: 'ORD-2026-1002' })).toBe('Туроператор подтвердил вашу бронь ORD-2026-1002.')
    expect(threadText('payment_received', 'ru', { ref: 'ORD-2026-1002', amount: '500 000 сум' })).toBe('Мы получили 500 000 сум по заказу ORD-2026-1002. Спасибо!')
    expect(threadText('service_issued', 'ru', { ref: 'ORD-2026-1002', service: 'Страховка' })).toBe('По заказу ORD-2026-1002 оформлено: Страховка.')
  })

  it('falls back to Russian for an unknown language', () => {
    expect(messageText('phone_code', 'de', { code: '123456' }).text).toBe('TripMe: код 123456 для подтверждения номера.')
  })

  it('opens only the channels a provider (or dev mode) gives', () => {
    const messenger = new LogMessenger(['email'])

    expect(messenger.available('email')).toBe(true)
    expect(messenger.available('sms')).toBe(false)
  })
})
