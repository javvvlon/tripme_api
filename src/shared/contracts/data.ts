/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export type AnyObject = Record<string, unknown>

export type CurrencyCode = 'USD' | 'EUR' | 'UZS'

export interface Money {
  amount: number
  currency: CurrencyCode
}

export interface Paginated<T> {
  items: T[]
  page: number
  size: number
  total: number
}
