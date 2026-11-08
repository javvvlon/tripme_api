import type { UzsBasis, UzsPrice } from './contracts/search'
import type { Offer } from './models/Offer'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const CBU_BUFFER = 0.02

export const roundUzs = (amount: number): number => Math.round(amount / 1000) * 1000

export function uzsByOperator(amount: number, rate: number | null): UzsPrice | null {
  if (!rate || !Number.isFinite(rate) || rate <= 0) return null

  return { amount: roundUzs(amount * rate), currency: 'UZS', basis: 'operator', rate }
}

export function uzsByCbu(amount: number, cbuRate: number | null | undefined, basis: UzsBasis = 'cbu'): UzsPrice | null {
  if (!cbuRate || !Number.isFinite(cbuRate) || cbuRate <= 0) return null

  const rate = Math.round(cbuRate * (1 + CBU_BUFFER) * 100) / 100

  return { amount: roundUzs(amount * rate), currency: 'UZS', basis, rate }
}

export function uzsAmountOf(offer: Offer): number | null {
  const price = offer.get('price')

  if (price.uzs) return price.uzs.amount

  return price.source.currency === 'UZS' ? price.source.amount : null
}

export function inUzsRange(amount: number | null, min?: number, max?: number): boolean {
  if (min === undefined && max === undefined) return true
  if (amount === null) return false

  return (min === undefined || amount >= min) && (max === undefined || amount <= max)
}

const ROUNDING_SLACK = 1000

export function nativePriceBounds(min: number | undefined, max: number | undefined, rate: number | null): { min?: number, max?: number } {
  if (!rate || !Number.isFinite(rate) || rate <= 0) return {}

  return {
    ...(min !== undefined ? { min: Math.max(0, Math.floor((min - ROUNDING_SLACK) / rate)) } : {}),
    ...(max !== undefined ? { max: Math.ceil((max + ROUNDING_SLACK) / rate) } : {}),
  }
}
