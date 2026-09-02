import { BadRequestException } from '@nestjs/common'
import type { CurrencyCode } from '~/shared/contracts/data'
import type { SearchCriteria } from './contracts/search'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface SearchQueryDto {
  from?: string
  to?: string
  date?: string
  dateTo?: string
  nights?: string
  nightsTo?: string
  adults?: string
  children?: string
  currency?: string
  stars?: string
  meals?: string
  resorts?: string
  hotels?: string
  priceMin?: string
  priceMax?: string
  suppliers?: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const list = (value: string | undefined): string[] =>
  (value ?? '').split(',').map(v => v.trim()).filter(Boolean)

const int = (value: string | undefined, fallback: number): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function toCriteria(query: SearchQueryDto): SearchCriteria {
  if (!query.from) throw new BadRequestException('from is required')
  if (!query.to) throw new BadRequestException('to is required')
  if (!query.date || !ISO_DATE.test(query.date)) {
    throw new BadRequestException('date is required, as YYYY-MM-DD')
  }

  const dateTo = query.dateTo && ISO_DATE.test(query.dateTo) ? query.dateTo : query.date
  const nightsFrom = int(query.nights, 7)

  return {
    from: query.from,
    to: query.to,
    dateFrom: query.date,
    dateTo,
    nightsFrom,
    nightsTo: int(query.nightsTo, nightsFrom),
    adults: int(query.adults, 2),
    childrenAges: list(query.children).map(Number).filter(Number.isFinite),
    currency: ((query.currency ?? 'USD').toUpperCase() as CurrencyCode),
    filters: {
      stars: list(query.stars).map(Number).filter(Number.isFinite),
      meals: list(query.meals),
      resorts: list(query.resorts),
      hotels: list(query.hotels),
      priceMin: query.priceMin ? Number(query.priceMin) : undefined,
      priceMax: query.priceMax ? Number(query.priceMax) : undefined,
      suppliers: list(query.suppliers),
    },
  }
}

/**
 * Criteria for "when could I go?", where the date is the question rather
 * than part of it. Defaults to today; filters play no part, since a day is
 * available or it is not.
 */
export function toSoonestCriteria(query: SearchQueryDto, today: string): SearchCriteria {
  if (!query.from) throw new BadRequestException('from is required')
  if (!query.to) throw new BadRequestException('to is required')

  const from = query.date && ISO_DATE.test(query.date) && query.date > today ? query.date : today
  const nightsFrom = int(query.nights, 7)

  return {
    from: query.from,
    to: query.to,
    dateFrom: from,
    dateTo: from,
    nightsFrom,
    nightsTo: int(query.nightsTo, nightsFrom),
    adults: int(query.adults, 2),
    childrenAges: list(query.children).map(Number).filter(Number.isFinite),
    currency: ((query.currency ?? 'USD').toUpperCase() as CurrencyCode),
    filters: { stars: [], meals: [], resorts: [], hotels: [], suppliers: [] },
  }
}
