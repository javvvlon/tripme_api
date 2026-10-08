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

export interface ILedgerEntry {
  direction: string
  amountUzs: number
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

export function paymentStatusOf(totalUzs: number, receivedUzs: number): PaymentStatus {
  if (receivedUzs <= 0) return PaymentStatus.Unpaid
  if (totalUzs > 0 && receivedUzs > totalUzs) return PaymentStatus.Overpaid
  if (receivedUzs >= totalUzs) return PaymentStatus.Paid

  return PaymentStatus.Partial
}

const sumOf = (entries: ILedgerEntry[], direction: PaymentDirection): number =>
  entries.filter(entry => entry.direction === direction).reduce((total, entry) => total + entry.amountUzs, 0)

export function summarize(
  items: IPricedItem[],
  entries: ILedgerEntry[],
  depositPercent: number | null,
  legacyPaid = false,
): IFinanceSummary {
  let totalUzs = 0
  let missingRates = 0

  for (const item of items) {
    if (INACTIVE_ITEMS.includes(item.status)) continue

    const uzs = itemUzs(item)

    if (uzs === null) missingRates += 1
    else totalUzs += uzs
  }

  const receivedUzs = sumOf(entries, PaymentDirection.CustomerIn) - sumOf(entries, PaymentDirection.CustomerRefund)
  const paidToSuppliersUzs = sumOf(entries, PaymentDirection.SupplierOut) - sumOf(entries, PaymentDirection.SupplierRefund)
  const percent = depositPercent ?? DEFAULT_DEPOSIT_PERCENT
  const depositUzs = Math.round(totalUzs * percent / 100 / 100) * 100

  if (legacyPaid) {
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

  return {
    totalUzs,
    missingRates,
    receivedUzs,
    paidToSuppliersUzs,
    balanceUzs: Math.max(0, totalUzs - receivedUzs),
    overpaidUzs: Math.max(0, receivedUzs - totalUzs),
    revenueUzs: receivedUzs - paidToSuppliersUzs,
    depositPercent: percent,
    depositUzs,
    depositMet: depositUzs > 0 && receivedUzs >= depositUzs,
    paymentStatus: paymentStatusOf(totalUzs, receivedUzs),
  }
}
