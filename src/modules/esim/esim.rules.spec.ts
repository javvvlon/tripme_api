import { describe, expect, it } from 'vitest'
import { EsimPaymentMethod, PAYMENT_WINDOW_MS, PurchaseStatus, checkoutOf, expired, maskEmail, newToken, retailUzs } from './esim.rules'
import { SandboxEsimProvider } from './provider/sandbox.provider'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const valid = { plan_id: 'sbx-tr-3072-15', email: ' Aziz@Example.UZ ', phone: '+998 93 555-11-22', method: 'payme', locale: 'uz' }

describe('eSIM rules', () => {
  it('prices in sum with the margin, rounded up to a thousand', () => {
    expect(retailUzs(9, 11809.19, 35)).toBe(144000)
    expect(retailUzs(4.5, 12000, 0)).toBe(54000)
    expect(() => retailUzs(0, 12000, 35)).toThrow()
  })

  it('reads a checkout', () => {
    expect(checkoutOf(valid)).toEqual({
      planId: 'sbx-tr-3072-15',
      email: 'aziz@example.uz',
      phone: '+998935551122',
      method: EsimPaymentMethod.Payme,
      locale: 'uz',
    })
    expect(checkoutOf({ ...valid, locale: 'de' }).locale).toBe('ru')
  })

  it('refuses a checkout it cannot deliver or charge', () => {
    expect(() => checkoutOf({ ...valid, plan_id: '' })).toThrow('tariff')
    expect(() => checkoutOf({ ...valid, email: 'aziz@' })).toThrow('email')
    expect(() => checkoutOf({ ...valid, phone: '935551122' })).toThrow('country code')
    expect(() => checkoutOf({ ...valid, method: 'paypal' })).toThrow('payment method')
  })

  it('keeps the receipt link hard to guess and the email private', () => {
    expect(newToken()).toMatch(/^[\w-]{24}$/)
    expect(newToken()).not.toBe(newToken())
    expect(maskEmail('aziz@example.uz')).toBe('az••@example.uz')
  })

  it('lets an unpaid purchase lapse after the payment window', () => {
    const at = new Date('2026-10-08T10:00:00Z')

    expect(expired(PurchaseStatus.AwaitingPayment, at, at.getTime() + PAYMENT_WINDOW_MS + 1)).toBe(true)
    expect(expired(PurchaseStatus.AwaitingPayment, at, at.getTime() + 1000)).toBe(false)
    expect(expired(PurchaseStatus.Issued, at, at.getTime() + PAYMENT_WINDOW_MS * 2)).toBe(false)
  })
})

describe('sandbox eSIM provider', () => {
  const provider = new SandboxEsimProvider()

  it('offers every country with its cheapest plan', async () => {
    const countries = await provider.countries()
    const turkey = countries.find(country => country.code === 'TR')

    expect(turkey).toMatchObject({ plans: 6, fromUsd: 4.5 })
  })

  it('issues an installable eSIM', async () => {
    const plan = (await provider.plan('sbx-tr-3072-15'))!
    const esim = await provider.issue(plan, 'ESIM-1001')

    expect(esim.lpa).toBe(`LPA:1$${esim.smdp}$${esim.activationCode}`)
    expect(esim.iccid).toMatch(/^8999\d{15}$/)
  })
})
