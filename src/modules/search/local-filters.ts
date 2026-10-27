import { mealKeyOf } from './meal-plans'
import { hotelKey } from './hotel-key'
import { resortKey } from './resorts'
import type { Offer } from './models/Offer'
import type { SearchFilters } from './contracts/search'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export type LocalFacet = 'stars' | 'meals' | 'resorts'

export const LOCAL_FACETS: LocalFacet[] = ['stars', 'resorts', 'meals']

const valueOf: Record<LocalFacet, (offer: Offer) => string | number> = {
  stars: offer => offer.get('hotelStars') ?? 0,
  resorts: offer => resortKey(offer.get('district') ?? ''),
  meals: offer => mealKeyOf(offer.get('mealCode'), offer.get('mealName')),
}

export function activeLocalFacets(filters: Partial<SearchFilters>, native: Set<string>): LocalFacet[] {
  return LOCAL_FACETS.filter(facet => (filters[facet]?.length ?? 0) > 0 && !native.has(facet))
}

export function localFilter(
  offers: Offer[],
  filters: Partial<SearchFilters>,
  native: Set<string>,
  skip?: LocalFacet,
): Offer[] {
  const active = activeLocalFacets(filters, native).filter(facet => facet !== skip)
  const hotels = new Set(filters.hotels ?? [])

  if (!active.length && !hotels.size) return offers

  const wanted: Record<LocalFacet, Array<string | number>> = {
    stars: filters.stars ?? [],
    meals: filters.meals ?? [],
    resorts: (filters.resorts ?? []).map(resortKey),
  }

  return offers.filter(offer =>
    (!hotels.size || hotels.has(hotelKey(offer.get('hotelName'))))
    && active.every(facet => wanted[facet].includes(valueOf[facet](offer))))
}
