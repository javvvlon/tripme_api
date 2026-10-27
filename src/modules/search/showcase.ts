import { Availability } from './contracts/search'
import type { IOffer } from './models/Offer'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const SHOWCASE_THEMES = ['all', 'beach', 'history', 'kids', 'discount'] as const

export type ShowcaseTheme = typeof SHOWCASE_THEMES[number]

export const THEME_COUNTRIES: Partial<Record<ShowcaseTheme, string[]>> = {
  beach: ['maldives', 'thailand', 'vietnam', 'egypt', 'uae', 'turkey', 'srilanka'],
  history: ['turkey', 'georgia', 'azerbaijan', 'italy', 'egypt'],
}

export const KIDS_PARTY = { adults: 2, childrenAges: [6], meals: ['AI', 'UAI', 'FB'] }

export const SHOWCASE_LEAD_DAYS = 7

export const SHOWCASE_SPAN_DAYS = 5

export const DEAL_PERCENT = 12

const MIN_GROUP = 5

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const themeOf = (value: unknown): ShowcaseTheme =>
  SHOWCASE_THEMES.includes(value as ShowcaseTheme) ? value as ShowcaseTheme : 'all'

export const addDays = (day: string, count: number): string => {
  const date = new Date(`${day}T00:00:00Z`)

  date.setUTCDate(date.getUTCDate() + count)

  return date.toISOString().slice(0, 10)
}

export function showcaseWindow(today: string, date?: string, dateTo?: string): { dateFrom: string, dateTo: string } {
  const earliest = addDays(today, 1)
  const start = date && ISO_DATE.test(date) && date >= earliest ? date : addDays(today, SHOWCASE_LEAD_DAYS)
  const end = dateTo && ISO_DATE.test(dateTo) && dateTo >= start ? dateTo : addDays(start, SHOWCASE_SPAN_DAYS)
  const latest = addDays(start, 7)

  return { dateFrom: start, dateTo: end > latest ? latest : end }
}

export function countriesOf<T extends { slug: string }>(available: T[], theme: ShowcaseTheme): T[] {
  const wanted = THEME_COUNTRIES[theme]

  return wanted ? available.filter(country => wanted.includes(country.slug)) : available
}

type Priced = Pick<IOffer, 'price' | 'oldPrice'>

export function discountOf(offer: Priced): number {
  const old = offer.oldPrice ?? 0
  const now = offer.price.source.amount

  return old > now && now > 0 ? Math.round((1 - now / old) * 100) : 0
}

export const priceOf = (offer: Pick<IOffer, 'price'>): number =>
  offer.price.uzs?.amount ?? offer.price.converted?.amount ?? offer.price.source.amount

export type SavingKind = 'old_price' | 'median'

export interface IShowcaseEntry {
  cheapest: IOffer | null
  deal: IOffer | null
  saving: number
  savingKind: SavingKind | null
  offers: number
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

type Rated = Pick<IOffer, 'price' | 'hotelStars' | 'nights'>

const nightly = (offer: Rated): number => priceOf(offer) / Math.max(1, offer.nights)

const rated = (offer: Rated): boolean => (offer.hotelStars ?? 0) >= 2

export function mediansOf(offers: Rated[]): Map<number, number> {
  const groups = new Map<number, number[]>()

  for (const offer of offers.filter(rated)) {
    groups.set(offer.hotelStars!, [...(groups.get(offer.hotelStars!) ?? []), nightly(offer)])
  }

  return new Map([...groups].filter(([, prices]) => prices.length >= MIN_GROUP).map(([stars, prices]) => [stars, median(prices)]))
}

export function economyOf(offer: Rated, medians: Map<number, number>): number {
  const typical = rated(offer) ? medians.get(offer.hotelStars!) : undefined
  const economy = typical ? Math.round((1 - nightly(offer) / typical) * 100) : 0

  return economy >= DEAL_PERCENT ? economy : 0
}

export function savingOf(offer: Priced & Rated, medians: Map<number, number>): number {
  return Math.max(discountOf(offer), economyOf(offer, medians))
}

export function entryOf(offers: IOffer[]): IShowcaseEntry {
  const sale = offers.filter(offer => offer.availability !== Availability.Stopped)
  const byPrice = [...sale].sort((a, b) => priceOf(a) - priceOf(b))
  const medians = mediansOf(sale)
  const deals = sale
    .map(offer => ({ offer, saving: savingOf(offer, medians), kind: (discountOf(offer) >= economyOf(offer, medians) ? 'old_price' : 'median') as SavingKind }))
    .filter(item => item.saving > 0)
    .sort((a, b) => b.saving - a.saving || priceOf(a.offer) - priceOf(b.offer))
  const best = deals[0]

  return { cheapest: byPrice[0] ?? null, deal: best?.offer ?? null, saving: best?.saving ?? 0, savingKind: best?.kind ?? null, offers: sale.length }
}

export const offerFor = (entry: IShowcaseEntry, theme: ShowcaseTheme): IOffer | null =>
  theme === 'discount' ? entry.deal : entry.cheapest

export function byTheme<T extends { offer: Priced | null, discount: number }>(cards: T[], theme: ShowcaseTheme): T[] {
  const rank = theme === 'discount'
    ? (a: T, b: T) => b.discount - a.discount || priceOf(a.offer!) - priceOf(b.offer!)
    : (a: T, b: T) => priceOf(a.offer!) - priceOf(b.offer!)

  return cards.filter(card => card.offer).sort(rank)
}
