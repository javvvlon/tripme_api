import { Availability, SupplierState } from '~/modules/search/contracts/search'
import type { SearchCriteria, SupplierStatus } from '~/modules/search/contracts/search'
import type { IOffer } from '~/modules/search/models/Offer'
import { hotelKey } from '~/modules/search/hotel-key'
import type { IAdTour } from './selection.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface ICheckGroup {
  criteria: SearchCriteria
  tours: IAdTour[]
}

const textOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const roomKey = (value: unknown): string => textOf(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

const agesOf = (tour: IAdTour): number[] =>
  Array.isArray(tour.kid_ages) ? (tour.kid_ages as unknown[]).map(Number).filter(Number.isFinite) : []

export const canCheck = (tour: IAdTour): boolean =>
  Boolean(textOf(tour.route_from) && textOf(tour.route_to) && tour.nights > 0)

export const departed = (tour: IAdTour, today: string): boolean => tour.check_in < today

export function checkGroups(tours: IAdTour[], today: string): ICheckGroup[] {
  const groups = new Map<string, ICheckGroup>()

  for (const tour of tours) {
    if (!canCheck(tour) || departed(tour, today)) continue

    const ages = agesOf(tour)
    const key = [tour.route_from, tour.route_to, tour.check_in, tour.nights, tour.adults, ages.join('.')].join('|')
    const group = groups.get(key) ?? {
      criteria: {
        from: textOf(tour.route_from),
        to: textOf(tour.route_to),
        dateFrom: tour.check_in,
        dateTo: tour.check_in,
        nightsFrom: tour.nights,
        nightsTo: tour.nights,
        adults: tour.adults,
        childrenAges: ages,
        currency: 'USD',
        filters: { stars: [], meals: [], resorts: [], hotels: [], suppliers: [] },
      },
      tours: [],
    }

    group.tours.push(tour)

    const hotel = hotelKey(tour.hotel_name)
    const supplier = textOf(tour.supplier_id)

    if (hotel && !group.criteria.filters.hotels.includes(hotel)) group.criteria.filters.hotels.push(hotel)
    if (supplier && !group.criteria.filters.suppliers.includes(supplier)) group.criteria.filters.suppliers.push(supplier)

    groups.set(key, group)
  }

  return [...groups.values()]
}

export function matchOffer(tour: IAdTour, offers: IOffer[]): IOffer | null {
  const supplier = textOf(tour.supplier_id)
  const hotel = hotelKey(tour.hotel_name)
  const meal = textOf(tour.meal_code).toLowerCase()
  const room = roomKey(tour.room_name)

  const same = offers.filter(offer =>
    (!supplier || offer.supplier.id === supplier)
    && hotelKey(offer.hotelName) === hotel
    && offer.checkIn === tour.check_in
    && offer.nights === tour.nights
    && textOf(offer.mealCode).toLowerCase() === meal
    && roomKey(offer.roomName) === room)

  return same.reduce<IOffer | null>(
    (best, offer) => (!best || offer.price.source.amount < best.price.source.amount ? offer : best),
    null,
  )
}

export function judge(tour: IAdTour, offer: IOffer | null, statuses: SupplierStatus[]): IAdTour {
  const supplier = textOf(tour.supplier_id)
  const status = statuses.find(item => item.supplier.id === supplier)
  const unsure = !status || status.state === SupplierState.Failed

  if (!offer || offer.availability === Availability.Stopped) {
    return { ...tour, check_state: !offer && unsure ? 'unknown' : 'gone', check_was: null }
  }

  const fresh = Math.round(offer.price.source.amount * 100) / 100

  if (Math.abs(fresh - tour.price_amount) < 0.5 && offer.price.source.currency === tour.price_currency) {
    return { ...tour, check_state: 'same', check_was: null, availability: offer.availability }
  }

  return {
    ...tour,
    price_amount: fresh,
    price_currency: offer.price.source.currency,
    price_uzs: offer.price.uzs?.amount ?? null,
    price_uzs_basis: offer.price.uzs?.basis ?? null,
    price_uzs_rate: offer.price.uzs?.rate ?? null,
    availability: offer.availability,
    check_state: 'changed',
    check_was: tour.price_amount,
  }
}

export function settle(tour: IAdTour, today: string): IAdTour | null {
  if (departed(tour, today)) return { ...tour, check_state: 'gone', check_was: null }
  if (!canCheck(tour)) return { ...tour, check_state: 'unknown', check_was: null }

  return null
}
