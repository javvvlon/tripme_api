import { Offer } from './models/Offer'
import { hotelKey } from './hotel-key'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export function withKnownStars(offers: Offer[], known: Map<string, number> = new Map()): Offer[] {
  for (const offer of offers) {
    const stars = offer.get('hotelStars')

    if (stars) known.set(hotelKey(offer.get('hotelName')), stars)
  }

  return offers.map((offer) => {
    if (offer.get('hotelStars')) return offer

    const stars = known.get(hotelKey(offer.get('hotelName')))

    return stars ? new Offer({ ...offer.payload(), hotelStars: stars }) : offer
  })
}
