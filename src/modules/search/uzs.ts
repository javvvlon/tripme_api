import type { UzsPrice } from './contracts/search'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const CBU_BUFFER = 0.015

export const roundUzs = (amount: number): number => Math.round(amount / 1000) * 1000

export function uzsByOperator(amount: number, rate: number | null): UzsPrice | null {
  if (!rate || !Number.isFinite(rate) || rate <= 0) return null

  return { amount: roundUzs(amount * rate), currency: 'UZS', basis: 'operator', rate }
}

export function uzsByCbu(amount: number, cbuRate: number | null | undefined): UzsPrice | null {
  if (!cbuRate || !Number.isFinite(cbuRate) || cbuRate <= 0) return null

  const rate = Math.round(cbuRate * (1 + CBU_BUFFER) * 100) / 100

  return { amount: roundUzs(amount * rate), currency: 'UZS', basis: 'cbu', rate }
}
