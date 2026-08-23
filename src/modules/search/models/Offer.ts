import { Model } from '~/shared/helpers/model'
import { Availability } from '~/modules/search/contracts/search'
import type { Money, PriceBreakdown, SupplierRef } from '~/modules/search/contracts/search'

/**
 * One bookable (or explicitly not-bookable) package: hotel + room + meal +
 * dates + price, from one supplier.
 *
 * This is the canonical shape every supplier normalises into. It is the only
 * shape the search API emits, and the frontend's Tour model mirrors it.
 *
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IOffer {
  /** deterministic: same offer from the same supplier yields the same id */
  id: string
  supplier: SupplierRef

  hotelName: string
  hotelStars: number | null
  /** supplier's own hotel code — the join key until identity resolution runs */
  hotelSupplierCode: string
  /** their canonical url path, a better cross-supplier hint than the name */
  hotelSlug: string | null
  district: string | null

  checkIn: string
  nights: number
  mealCode: string | null
  mealName: string | null
  roomName: string | null

  adults: number
  children: number

  price: PriceBreakdown
  availability: Availability
  /** «Остановка продаж с … по …» — shown verbatim, never paraphrased */
  availabilityNote: string | null
  flightNote: string | null
  refundable: boolean | null

  /** programme/tour name, e.g. «TR: Стамбул из Ташкента» */
  programme: string | null
  fare: string | null
}

export class Offer extends Model<IOffer> {
  public isBookable(): boolean {
    return this.get('availability') === Availability.Available
  }

  /** What the results list sorts by: the supplier's own number, not a conversion. */
  public sortPrice(): number {
    return this.get('price').source.amount
  }

  /**
   * Identity for merging the same physical offer arriving twice — across page
   * boundaries, or from a retry. Deliberately excludes price: a price change
   * between pages is a new value for the same offer, not a new offer.
   */
  public dedupeKey(): string {
    return [
      this.get('supplier').id,
      this.get('hotelSupplierCode'),
      this.get('checkIn'),
      this.get('nights'),
      this.get('mealCode'),
      this.get('roomName'),
      this.get('programme'),
    ].join('|')
  }
}

export type { Money }
