import type { Offer } from './models/Offer'
import { Availability } from './contracts/search'
import { MEAL_PLANS, mealKeyOf, mealPlanOf } from './meal-plans'
import type { MealPlan } from './meal-plans'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface FacetOption {
  value: string
  label: string
  count: number
}

export interface SearchFacets {
  suppliers: FacetOption[]
  stars: FacetOption[]
  meals: FacetOption[]
  districts: FacetOption[]
  availability: FacetOption[]
  priceFrom: { amount: number, currency: string } | null
  priceMin: number | null
  priceMax: number | null
  priceBuckets: Array<{ from: number, to: number, count: number }>
  days: DayPrice[]
  currency: string | null
  partial: boolean
  total: number
}

export interface DayPrice {
  date: string
  price: { amount: number, currency: string }
  count: number
}

const TYPICAL_SHARE = 0.95

const BUCKETS = 6

export function cheapestByDay(offers: Offer[]): DayPrice[] {
  const days = new Map<string, { offer: Offer, count: number }>()

  for (const offer of offers) {
    const date = offer.get('checkIn')
    if (!date) continue

    const entry = days.get(date)

    if (!entry) days.set(date, { offer, count: 1 })
    else {
      entry.count += 1
      if (offer.sortPrice() < entry.offer.sortPrice()) entry.offer = offer
    }
  }

  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { offer, count }]) => {
      const price = offer.get('price')
      const { amount, currency } = price.converted ?? price.source

      return { date, price: { amount, currency }, count }
    })
}

const planRank = (value: string): number => {
  const rank = MEAL_PLANS.indexOf(value as MealPlan)

  return rank === -1 ? MEAL_PLANS.length : rank
}

function tally(
  offers: Offer[],
  pick: (offer: Offer) => { value: string, label: string } | null,
): FacetOption[] {
  const counts = new Map<string, FacetOption>()

  for (const offer of offers) {
    const entry = pick(offer)
    if (!entry) continue

    const existing = counts.get(entry.value)
    if (existing) existing.count += 1
    else counts.set(entry.value, { ...entry, count: 1 })
  }

  return [...counts.values()].sort((a, b) => b.count - a.count)
}

export interface IFacetScopes {
  stars?: Offer[]
  meals?: Offer[]
  districts?: Offer[]
}

export function buildFacets(offers: Offer[], pageSize: number, scopes: IFacetScopes = {}): SearchFacets {
  const prices = offers.map(o => o.sortPrice()).filter(Number.isFinite)
  const min = prices.length ? Math.min(...prices) : null
  const max = prices.length ? Math.max(...prices) : null

  const buckets: SearchFacets['priceBuckets'] = []
  if (min !== null && max !== null && max > min) {
    const sorted = [...prices].sort((a, b) => a - b)
    const ceiling = sorted[Math.floor((sorted.length - 1) * TYPICAL_SHARE)] ?? max
    const top = ceiling > min ? ceiling : max
    const step = (top - min) / BUCKETS

    for (let i = 0; i < BUCKETS; i++) {
      const from = min + step * i
      const last = i === BUCKETS - 1
      const to = last ? max : from + step
      buckets.push({
        from: Math.round(from),
        to: Math.round(to),
        count: prices.filter(p => p >= from && (last ? p <= to : p < to)).length,
      })
    }
  }

  return {
    stars: tally(scopes.stars ?? offers, (o) => {
      const stars = o.get('hotelStars')
      return stars ? { value: String(stars), label: '★'.repeat(stars) } : null
    }).sort((a, b) => Number(b.value) - Number(a.value)),

    suppliers: tally(offers, o => ({
      value: o.get('supplier').id,
      label: o.get('supplier').name,
    })),

    meals: tally(scopes.meals ?? offers, (o) => {
      const code = o.get('mealCode')
      const name = o.get('mealName')
      const key = mealKeyOf(code, name)

      return key ? { value: key, label: mealPlanOf(code, name) ? key : name || key } : null
    }).sort((a, b) => planRank(a.value) - planRank(b.value)),

    districts: tally(scopes.districts ?? offers, (o) => {
      const district = o.get('district')
      return district ? { value: district, label: district } : null
    }),

    availability: tally(offers, o => ({
      value: o.get('availability'),
      label: o.get('availability'),
    })).sort((a, b) =>
      Number(a.value === Availability.Stopped) - Number(b.value === Availability.Stopped)),

    priceFrom: (() => {
      const price = [...offers].sort((a, b) => a.sortPrice() - b.sortPrice())[0]?.get('price')
      const cheapest = price ? (price.converted ?? price.source) : null

      return cheapest ? { amount: cheapest.amount, currency: cheapest.currency } : null
    })(),

    priceMin: min !== null ? Math.floor(min) : null,
    priceMax: max !== null ? Math.ceil(max) : null,
    priceBuckets: buckets,
    days: cheapestByDay(offers),
    currency: (() => {
      const price = offers[0]?.get('price')

      return price ? (price.converted?.currency ?? price.source.currency) : null
    })(),

    partial: offers.length >= pageSize,
    total: offers.length,
  }
}
