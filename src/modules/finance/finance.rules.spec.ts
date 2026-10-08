import { describe, expect, it } from 'vitest'
import { DEFAULT_DEPOSIT_PERCENT, PaymentDirection, PaymentStatus, itemUzs, paymentStatusOf, rateFor, summarize, toUzs } from './finance.rules'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const tour = { status: 'requested', priceAmount: 1132, priceCurrency: 'USD', fxRate: 11809 }
const transfer = { status: 'confirmed', priceAmount: 25, priceCurrency: 'USD', fxRate: 11809 }
const insurance = { status: 'draft', priceAmount: 180000, priceCurrency: 'UZS', fxRate: null }

describe('finance rules', () => {
  it('converts with the frozen rate and rounds to whole sum', () => {
    expect(toUzs(1132, 11809.37)).toBe(13368207)
    expect(itemUzs(tour)).toBe(13367788)
    expect(itemUzs(insurance)).toBe(180000)
    expect(itemUzs({ ...tour, fxRate: null })).toBeNull()
  })

  it('suggests a rate only for known currencies', () => {
    expect(rateFor('UZS', {})).toBe(1)
    expect(rateFor('USD', { USD: 11809 })).toBe(11809)
    expect(rateFor('EUR', { USD: 11809 })).toBeNull()
  })

  it('derives the payment status from money received', () => {
    expect(paymentStatusOf(1000, 0)).toBe(PaymentStatus.Unpaid)
    expect(paymentStatusOf(1000, 400)).toBe(PaymentStatus.Partial)
    expect(paymentStatusOf(1000, 1000)).toBe(PaymentStatus.Paid)
    expect(paymentStatusOf(1000, 1200)).toBe(PaymentStatus.Overpaid)
  })

  it('sums active services, nets refunds and reversals, and checks the deposit', () => {
    const summary = summarize(
      [tour, transfer, insurance, { ...transfer, status: 'cancelled' }],
      [
        { direction: PaymentDirection.CustomerIn, amountUzs: 3_000_000 },
        { direction: PaymentDirection.CustomerIn, amountUzs: 2_000_000 },
        { direction: PaymentDirection.CustomerIn, amountUzs: -2_000_000 },
        { direction: PaymentDirection.CustomerIn, amountUzs: 2_000_000 },
        { direction: PaymentDirection.SupplierOut, amountUzs: 4_000_000 },
        { direction: PaymentDirection.CustomerRefund, amountUzs: 500_000 },
      ],
      null,
    )

    expect(summary.totalUzs).toBe(13367788 + 295225 + 180000)
    expect(summary.receivedUzs).toBe(4_500_000)
    expect(summary.paidToSuppliersUzs).toBe(4_000_000)
    expect(summary.revenueUzs).toBe(500_000)
    expect(summary.depositPercent).toBe(DEFAULT_DEPOSIT_PERCENT)
    expect(summary.depositUzs).toBe(4_152_900)
    expect(summary.depositMet).toBe(true)
    expect(summary.paymentStatus).toBe(PaymentStatus.Partial)
    expect(summary.balanceUzs).toBe(summary.totalUzs - 4_500_000)
  })

  it('treats orders paid before the payment log as settled', () => {
    const summary = summarize([tour], [], null, true)

    expect(summary.paymentStatus).toBe(PaymentStatus.Paid)
    expect(summary.balanceUzs).toBe(0)
    expect(summary.depositMet).toBe(true)
  })

  it('counts services without a rate instead of guessing', () => {
    const summary = summarize([{ ...tour, fxRate: null }, insurance], [], 50)

    expect(summary.missingRates).toBe(1)
    expect(summary.totalUzs).toBe(180000)
    expect(summary.depositUzs).toBe(90000)
    expect(summary.depositMet).toBe(false)
  })
})
