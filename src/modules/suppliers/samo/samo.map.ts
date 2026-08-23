import { Offer } from '~/modules/search/models/Offer'
import { Availability } from '~/modules/search/contracts/search'
import { CURRENCY_BY_CODE } from '~/modules/suppliers/dictionary/dictionary.seed'
import type { IOffer } from '~/modules/search/models/Offer'
import type { SearchCriteria, SupplierRef } from '~/modules/search/contracts/search'
import type { SamoRow } from './samo.contracts'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export function toAvailability(row: SamoRow): Availability {
  if (row.saleState === 'stop') return Availability.Stopped
  if (row.availabilityCode.includes('N')) return Availability.Stopped
  if (row.availabilityCode.includes('R')) return Availability.OnRequest
  if (row.saleState === 'bron') return Availability.Available

  return Availability.Unknown
}

export function fromSamoDate(value: string): string {
  return /^\d{8}$/.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
    : value
}

export function mapSamoRow(row: SamoRow, criteria: SearchCriteria, supplier: SupplierRef): Offer | null {
  const amount = Number(row.priceSource)
  if (!Number.isFinite(amount) || amount <= 0) return null

  const currency = CURRENCY_BY_CODE[row.currencySource]
  if (!currency) return null

  const checkIn = fromSamoDate(row.checkin)
  const nights = Number(row.nights) || criteria.nightsFrom

  const properties: IOffer = {
    id: [supplier.id, row.hotel, row.checkin, row.nights, row.meal, row.room, row.tour].join(':'),
    supplier,

    hotelName: row.hotelName,
    hotelStars: row.stars ? Number(row.stars) : null,
    hotelSupplierCode: row.hotel,
    hotelSlug: row.hotelSlug || null,
    district: row.district || null,

    checkIn,
    nights,
    mealCode: row.meal || null,
    mealName: row.mealText || null,
    roomName: row.roomText || null,

    adults: criteria.adults,
    children: criteria.childrenAges.length,

    price: {
      source: { amount, currency },
    },

    availability: toAvailability(row),
    availabilityNote: row.stopReason || row.availabilityText || null,
    flightNote: row.flightText || null,
    refundable: row.roomText ? !/NON\s*REF/i.test(row.roomText) : null,

    programme: row.tourName || null,
    fare: row.fare || null,
  }

  return new Offer(properties)
}
