/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const DEFAULT_DEPOSIT_PERCENT = 30

export enum PaymentDirection {
  CustomerIn = 'customer_in',
  CustomerRefund = 'customer_refund',
  SupplierOut = 'supplier_out',
  SupplierRefund = 'supplier_refund',
}

export const PAYMENT_DIRECTIONS = Object.values(PaymentDirection)

export const CUSTOMER_DIRECTIONS: PaymentDirection[] = [PaymentDirection.CustomerIn, PaymentDirection.CustomerRefund]

export enum PaymentMethod {
  Cash = 'cash',
  Uzcard = 'uzcard',
  Humo = 'humo',
  Card = 'card',
  Transfer = 'transfer',
}

export const PAYMENT_METHODS = Object.values(PaymentMethod)

export enum PaymentStatus {
  Unpaid = 'unpaid',
  Partial = 'partial',
  Paid = 'paid',
  Overpaid = 'overpaid',
}

export const PAYMENT_CURRENCIES = ['UZS', 'USD', 'EUR'] as const

export interface IPricedItem {
  status: string
  priceAmount: number | null
  priceCurrency: string
  fxRate: number | null
}

export type RateTable = Record<string, number>

export interface ILedgerEntry {
  direction: string
  amountUzs: number
  paidAt?: string
  rates?: RateTable | null
}

export interface IFinanceSummary {
  totalUzs: number
  missingRates: number
  receivedUzs: number
  paidToSuppliersUzs: number
  balanceUzs: number
  overpaidUzs: number
  revenueUzs: number
  depositPercent: number
  depositUzs: number
  depositMet: boolean
  paymentStatus: PaymentStatus
}

const INACTIVE_ITEMS = ['cancelled', 'rejected']

export const toUzs = (amount: number, rate: number): number => Math.round(amount * rate)

export const rateFor = (currency: string, rates: Record<string, number>): number | null => {
  if (!currency || currency === 'UZS') return 1

  const rate = rates[currency]

  return Number.isFinite(rate) && rate > 0 ? rate : null
}

export function itemUzs(item: IPricedItem): number | null {
  if (item.priceAmount === null || !Number.isFinite(item.priceAmount)) return 0

  const rate = item.priceCurrency === 'UZS' || !item.priceCurrency ? 1 : item.fxRate

  return rate ? toUzs(item.priceAmount, rate) : null
}

export function paymentStatusOf(receivedUzs: number, balanceUzs: number, overpaidUzs: number): PaymentStatus {
  if (receivedUzs <= 0) return PaymentStatus.Unpaid
  if (overpaidUzs > 0) return PaymentStatus.Overpaid
  if (balanceUzs <= 0) return PaymentStatus.Paid

  return PaymentStatus.Partial
}

const SETTLED_BELOW_UZS = 1000

const sumOf = (entries: ILedgerEntry[], direction: PaymentDirection): number =>
  entries.filter(entry => entry.direction === direction).reduce((total, entry) => total + entry.amountUzs, 0)

const valueOf = (amounts: Map<string, number>, rates: (currency: string) => number): number =>
  [...amounts].reduce((total, [currency, amount]) => total + amount * rates(currency), 0)

export function summarize(
  items: IPricedItem[],
  entries: ILedgerEntry[],
  depositPercent: number | null,
  legacyPaid = false,
  today: RateTable = {},
): IFinanceSummary {
  const owed = new Map<string, number>()
  const agreed = new Map<string, number>()
  let missingRates = 0

  for (const item of items) {
    if (INACTIVE_ITEMS.includes(item.status)) continue
    if (item.priceAmount === null || !Number.isFinite(item.priceAmount)) continue

    const currency = item.priceCurrency || 'UZS'

    if (currency !== 'UZS' && !rateFor(currency, today) && !item.fxRate) {
      missingRates += 1
      continue
    }

    owed.set(currency, (owed.get(currency) ?? 0) + item.priceAmount)
    if (currency !== 'UZS' && item.fxRate && !agreed.has(currency)) agreed.set(currency, item.fxRate)
  }

  const todayRate = (currency: string): number => rateFor(currency, today) ?? agreed.get(currency) ?? 0
  const agreedRate = (currency: string): number => (currency === 'UZS' ? 1 : agreed.get(currency) ?? todayRate(currency))

  const remaining = new Map(owed)
  let surplusUzs = 0

  const customer = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => CUSTOMER_DIRECTIONS.includes(entry.direction as PaymentDirection))
    .sort((a, b) => (a.entry.paidAt ?? '').localeCompare(b.entry.paidAt ?? '') || a.index - b.index)

  for (const { entry } of customer) {
    const rateAt = (currency: string): number => (currency === 'UZS' ? 1 : entry.rates?.[currency] ?? agreedRate(currency))
    let signed = entry.direction === PaymentDirection.CustomerIn ? entry.amountUzs : -entry.amountUzs

    if (signed > 0) {
      const due = valueOf(remaining, rateAt)

      if (due <= 0) {
        surplusUzs += signed
        continue
      }

      const share = Math.min(1, signed / due)

      for (const [currency, amount] of remaining) remaining.set(currency, amount * (1 - share))

      surplusUzs += Math.max(0, signed - due)
      continue
    }

    const fromSurplus = Math.min(surplusUzs, -signed)

    surplusUzs -= fromSurplus
    signed += fromSurplus

    if (signed >= 0) continue

    const paid = new Map([...owed].map(([currency, amount]) => [currency, amount - (remaining.get(currency) ?? 0)]))
    const paidValue = valueOf(paid, rateAt)

    if (paidValue <= 0) continue

    const back = Math.min(1, -signed / paidValue)

    for (const [currency, amount] of paid) remaining.set(currency, (remaining.get(currency) ?? 0) + amount * back)
  }

  const receivedUzs = sumOf(entries, PaymentDirection.CustomerIn) - sumOf(entries, PaymentDirection.CustomerRefund)
  const paidToSuppliersUzs = sumOf(entries, PaymentDirection.SupplierOut) - sumOf(entries, PaymentDirection.SupplierRefund)
  const percent = depositPercent ?? DEFAULT_DEPOSIT_PERCENT
  const roundDeposit = (total: number): number => Math.round(total * percent / 100 / 100) * 100

  if (legacyPaid) {
    const totalUzs = Math.round(valueOf(owed, agreedRate))
    const depositUzs = roundDeposit(totalUzs)

    return {
      totalUzs,
      missingRates,
      receivedUzs,
      paidToSuppliersUzs,
      balanceUzs: 0,
      overpaidUzs: 0,
      revenueUzs: receivedUzs - paidToSuppliersUzs,
      depositPercent: percent,
      depositUzs,
      depositMet: true,
      paymentStatus: PaymentStatus.Paid,
    }
  }

  const leftRaw = valueOf(remaining, todayRate)
  const owedToday = valueOf(owed, todayRate)
  const left = Math.round(leftRaw)
  const balanceUzs = left < SETTLED_BELOW_UZS ? 0 : left
  const overpaidUzs = Math.round(surplusUzs)
  const totalUzs = Math.max(0, receivedUzs + balanceUzs - overpaidUzs)
  const depositUzs = roundDeposit(totalUzs)
  const paidShare = owedToday > 0 ? (balanceUzs === 0 ? 1 : 1 - leftRaw / owedToday) : 0

  return {
    totalUzs,
    missingRates,
    receivedUzs,
    paidToSuppliersUzs,
    balanceUzs,
    overpaidUzs,
    revenueUzs: receivedUzs - paidToSuppliersUzs,
    depositPercent: percent,
    depositUzs,
    depositMet: depositUzs > 0 && paidShare * 100 >= percent - 0.01,
    paymentStatus: paymentStatusOf(receivedUzs, balanceUzs, overpaidUzs),
  }
}
