import { describe, expect, it } from 'vitest'
import { documentMoneyOf } from './document-lines'
import type { IOrderItemPayload } from '../items/order-items.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const item = (over: Partial<IOrderItemPayload>): IOrderItemPayload => ({
  uuid: 'i', position: 0, kind: 'package', status: 'requested', title: 'Rixos Premium Seagate 5*',
  supplier_name: '', supplier_ref: '', offer_id: '', service_start: '2026-11-04', service_end: '2026-11-14',
  price_amount: 2400, price_currency: 'USD', price_uzs: 28342056, cost_amount: null, cost_currency: '',
  fx_rate: 11809.19, fx_date: '2026-10-08', agreed_rate: 11809.19, required_for_confirmation: true, details: {},
  ...over,
})

describe('document lines', () => {
  it('lists every live service and sums them in sum', () => {
    const money = documentMoneyOf([
      item({}),
      item({ kind: 'visa', status: 'confirmed', title: 'Шенгенская виза', service_end: null, price_amount: 180, price_uzs: 2125654 }),
      item({ kind: 'insurance', status: 'cancelled', price_uzs: 271611 }),
    ], { receivedUzs: 9636300, balanceUzs: 20831410, totalUzs: 28342056 + 2125654, ratesDate: '2026-10-10', settled: false })

    expect(money.lines.map(line => line.kind)).toEqual(['Турпакет', 'Виза'])
    expect(money.lines[0]).toMatchObject({ when: '04.11.2026 — 14.11.2026', uzs: 28342056 })
    expect(money.lines[1]).toMatchObject({ when: '04.11.2026' })
    expect(money.lines[0]!.price.replace(/\s/g, ' ')).toBe('2 400 USD')
    expect(money.totalUzs).toBe(28342056 + 2125654)
    expect(money).toMatchObject({ receivedUzs: 9636300, balanceUzs: 20831410, missingRates: 0, ratesDate: '2026-10-10' })
  })

  it('counts a service it cannot convert instead of guessing', () => {
    const money = documentMoneyOf([item({ price_uzs: null, fx_rate: null })])

    expect(money).toMatchObject({ totalUzs: 0, missingRates: 1 })
  })
})
