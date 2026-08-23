import type { Offer } from './models/Offer'
import { Availability } from './contracts/search'

/**
 * Facet counts derived from the offers we actually received.
 *
 * Deliberately not "how many tours exist" — SAMO answers with a page of the
 * 100 cheapest rows and no totals, so any number claiming to describe the whole
 * market would be a guess. These counts describe *this result set*, and
 * `partial` says so.
 *
 * That distinction has teeth: because a page is the cheapest rows, filtering
 * locally on these facets would narrow an already-truncated list and look
 * confident doing it. Filters therefore go back into the query and re-run the
 * search — which is why the API returns facets rather than the client deriving
 * them.
 *
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface FacetOption {
  value: string
  label: string
  count: number
}

export interface SearchFacets {
  stars: FacetOption[]
  meals: FacetOption[]
  districts: FacetOption[]
  availability: FacetOption[]
  priceMin: number | null
  priceMax: number | null
  priceBuckets: Array<{ from: number, to: number, count: number }>
  currency: string | null
  /** true when the result set was capped, so the counts are a lower bound */
  partial: boolean
  total: number
}

const BUCKETS = 6

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

export function buildFacets(offers: Offer[], pageSize: number): SearchFacets {
  const prices = offers.map(o => o.sortPrice()).filter(Number.isFinite)
  const min = prices.length ? Math.min(...prices) : null
  const max = prices.length ? Math.max(...prices) : null

  const buckets: SearchFacets['priceBuckets'] = []
  if (min !== null && max !== null && max > min) {
    const step = (max - min) / BUCKETS

    for (let i = 0; i < BUCKETS; i++) {
      const from = min + step * i
      const to = i === BUCKETS - 1 ? max : from + step
      buckets.push({
        from: Math.round(from),
        to: Math.round(to),
        count: prices.filter(p => p >= from && (i === BUCKETS - 1 ? p <= to : p < to)).length,
      })
    }
  }

  return {
    stars: tally(offers, (o) => {
      const stars = o.get('hotelStars')
      return stars ? { value: String(stars), label: '★'.repeat(stars) } : null
    }).sort((a, b) => Number(b.value) - Number(a.value)),

    meals: tally(offers, (o) => {
      const code = o.get('mealCode')
      const name = o.get('mealName')
      return code && name ? { value: code, label: name } : null
    }),

    districts: tally(offers, (o) => {
      const district = o.get('district')
      return district ? { value: district, label: district } : null
    }),

    availability: tally(offers, o => ({
      value: o.get('availability'),
      label: o.get('availability'),
    })).sort((a, b) =>
      Number(a.value === Availability.Stopped) - Number(b.value === Availability.Stopped)),

    priceMin: min !== null ? Math.floor(min) : null,
    priceMax: max !== null ? Math.ceil(max) : null,
    priceBuckets: buckets,
    currency: offers[0]?.get('price').source.currency ?? null,

    // A full page means the listing was cut, so every count below is a floor.
    partial: offers.length >= pageSize,
    total: offers.length,
  }
}
