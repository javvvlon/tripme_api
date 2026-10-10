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

  it('derives the payment status from what is received and still owed', () => {
    expect(paymentStatusOf(0, 1000, 0)).toBe(PaymentStatus.Unpaid)
    expect(paymentStatusOf(400, 600, 0)).toBe(PaymentStatus.Partial)
    expect(paymentStatusOf(1000, 0, 0)).toBe(PaymentStatus.Paid)
    expect(paymentStatusOf(1200, 0, 200)).toBe(PaymentStatus.Overpaid)
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

  describe('remainder at today\'s rate', () => {
    const trip = { status: 'confirmed', priceAmount: 1000, priceCurrency: 'USD', fxRate: 12000 }
    const paid = (amountUzs: number, paidAt: string, usd: number) =>
      ({ direction: PaymentDirection.CustomerIn, amountUzs, paidAt, rates: { USD: usd } })

    it('asks for the rest at today\'s rate, five days after half was paid', () => {
      const summary = summarize([trip], [paid(6_000_000, '2026-10-05', 12000)], null, false, { USD: 12100 })

      expect(summary.receivedUzs).toBe(6_000_000)
      expect(summary.balanceUzs).toBe(6_050_000)
      expect(summary.totalUzs).toBe(12_050_000)
      expect(summary.paymentStatus).toBe(PaymentStatus.Partial)
    })

    it('settles once the rest is paid at that rate', () => {
      const summary = summarize(
        [trip],
        [paid(6_000_000, '2026-10-05', 12000), paid(6_050_000, '2026-10-10', 12100)],
        null, false, { USD: 12100 },
      )

      expect(summary.balanceUzs).toBe(0)
      expect(summary.overpaidUzs).toBe(0)
      expect(summary.totalUzs).toBe(12_050_000)
      expect(summary.paymentStatus).toBe(PaymentStatus.Paid)
    })

    it('leaves an order paid before the switch exactly as it was', () => {
      const before = summarize([trip], [{ direction: PaymentDirection.CustomerIn, amountUzs: 12_000_000 }], null, false, {})
      const after = summarize([trip], [{ direction: PaymentDirection.CustomerIn, amountUzs: 12_000_000 }], null, false, { USD: 12500 })

      expect(after).toEqual(before)
      expect(after.totalUzs).toBe(12_000_000)
      expect(after.paymentStatus).toBe(PaymentStatus.Paid)
    })

    it('prices an unpaid order at today\'s rate', () => {
      const summary = summarize([trip], [], null, false, { USD: 12100 })

      expect(summary.totalUzs).toBe(12_100_000)
      expect(summary.balanceUzs).toBe(12_100_000)
    })

    it('ignores dust from rounding the rate', () => {
      const summary = summarize(
        [trip],
        [paid(6_000_000, '2026-10-05', 12000), paid(6_049_500, '2026-10-10', 12100)],
        null, false, { USD: 12100 },
      )

      expect(summary.balanceUzs).toBe(0)
      expect(summary.paymentStatus).toBe(PaymentStatus.Paid)
    })

    it('keeps sum-priced services at face value in a mixed order', () => {
      const cover = { status: 'confirmed', priceAmount: 500_000, priceCurrency: 'UZS', fxRate: null }
      const summary = summarize([trip, cover], [paid(6_250_000, '2026-10-05', 12000)], null, false, { USD: 12100 })

      expect(summary.balanceUzs).toBe(6_050_000 + 250_000)
    })

    it('reports money paid beyond the order as overpaid', () => {
      const summary = summarize([trip], [paid(13_000_000, '2026-10-05', 12000)], null, false, { USD: 12100 })

      expect(summary.balanceUzs).toBe(0)
      expect(summary.overpaidUzs).toBe(1_000_000)
      expect(summary.paymentStatus).toBe(PaymentStatus.Overpaid)
    })

    it('puts a reversed payment back on the bill at today\'s rate', () => {
      const summary = summarize(
        [trip],
        [paid(6_000_000, '2026-10-05', 12000), paid(-6_000_000, '2026-10-06', 12000)],
        null, false, { USD: 12100 },
      )

      expect(summary.balanceUzs).toBe(12_100_000)
      expect(summary.paymentStatus).toBe(PaymentStatus.Unpaid)
    })

    it('credits older payments at the rate the service was priced at', () => {
      const summary = summarize(
        [trip],
        [{ direction: PaymentDirection.CustomerIn, amountUzs: 6_000_000 }],
        null, false, { USD: 12100 },
      )

      expect(summary.balanceUzs).toBe(6_050_000)
    })

    it('counts the deposit as met by the share of the trip paid, not by sum', () => {
      const summary = summarize([trip], [paid(3_600_000, '2026-10-05', 12000)], 30, false, { USD: 12100 })

      expect(summary.depositUzs).toBe(Math.round((3_600_000 + 8_470_000) * 0.3 / 100) * 100)
      expect(summary.depositMet).toBe(true)
    })
  })
})
