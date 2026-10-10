import { Model } from '~/shared/helpers/model'
import { Availability } from '~/modules/search/contracts/search'
import type { Money, PriceBreakdown, SupplierRef } from '~/modules/search/contracts/search'
import { mealPlanOf } from '../meal-plans'
import type { MealPlan } from '../meal-plans'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IOffer {
  id: string
  supplier: SupplierRef

  hotelName: string
  hotelStars: number | null
  hotelSupplierCode: string
  hotelSlug: string | null
  hotelUrl: string | null

  bookingUrl: string | null
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
  availabilityNote: string | null
  flightNote: string | null
  refundable: boolean | null

  programme: string | null
  fare: string | null
}

export class Offer extends Model<IOffer> {
  public isBookable(): boolean {
    return this.get('availability') === Availability.Available
  }

  public isStopped(): boolean {
    return this.get('availability') === Availability.Stopped
  }

  public sortPrice(): number {
    const price = this.get('price')

    return price.converted?.amount ?? price.source.amount
  }

  public resolveMealPlan(): MealPlan | null {
    return mealPlanOf(this.get('mealCode'), this.get('mealName'))
  }

  public override toObject(): IOffer & { mealPlan: MealPlan | null } {
    return { ...super.toObject(), mealPlan: this.resolveMealPlan() }
  }

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
