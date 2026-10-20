import { describe, expect, it } from 'vitest'
import { PaymentDirection, PaymentStatus, basisOf, bufferedRates, operatorTable, summarize } from './finance.rules'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const cbu = { USD: 12_000, EUR: 13_000 }

describe('operator rates', () => {
  it('falls back to the central bank rate plus the 2% buffer', () => {
    expect(bufferedRates(cbu)).toEqual({ USD: 12_240, EUR: 13_260 })
    expect(operatorTable({}, cbu)).toEqual({ rates: { USD: 12_240, EUR: 13_260 }, operator: [] })
  })

  it('takes the operator rate per currency and keeps the buffer for the rest', () => {
    const table = operatorTable({ USD: 12_350 }, cbu)

    expect(table.rates).toEqual({ USD: 12_350, EUR: 13_260 })
    expect(basisOf(table, 'USD')).toBe('operator')
    expect(basisOf(table, 'EUR')).toBe('cbu')
    expect(basisOf(table, 'UZS')).toBeNull()
  })

  it('ignores an operator rate far from the central bank', () => {
    expect(operatorTable({ USD: 1.2, EUR: 15_500 }, cbu).operator).toEqual([])
    expect(operatorTable({ USD: 13_700 }, cbu).operator).toEqual(['USD'])
  })
})

describe('balance at the operator rate', () => {
  const tour = [{ status: 'confirmed', priceAmount: 1000, priceCurrency: 'USD', fxRate: 12_000 }]

  it('prices what is still owed at the operator rate of today', () => {
    const summary = summarize(tour, [], 30, false, { USD: 12_300 })

    expect(summary.balanceUzs).toBe(12_300_000)
    expect(summary.depositUzs).toBe(3_690_000)
  })

  it('credits a sum payment at the operator rate of its own day', () => {
    const paid = { direction: PaymentDirection.CustomerIn, amountUzs: 6_150_000, paidAt: '2026-10-20', rates: { USD: 12_300 } }
    const summary = summarize(tour, [paid], 30, false, { USD: 12_400 })

    expect(summary.balanceUzs).toBe(6_200_000)
    expect(summary.paymentStatus).toBe(PaymentStatus.Partial)
  })

  it('keeps a fully paid order settled when the rate moves later', () => {
    const paid = { direction: PaymentDirection.CustomerIn, amountUzs: 12_300_000, paidAt: '2026-10-20', rates: { USD: 12_300 } }

    expect(summarize(tour, [paid], 30, false, { USD: 12_600 }).balanceUzs).toBe(0)
  })
})
