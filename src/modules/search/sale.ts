import type { Offer } from './models/Offer'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export function cheapestOnSale(offers: Offer[]): Offer[] {
  const byId = new Map<string, Offer>()

  for (const offer of offers) {
    if (offer.isStopped()) continue

    const seen = byId.get(offer.get('id'))

    if (!seen || offer.sortPrice() < seen.sortPrice()) byId.set(offer.get('id'), offer)
  }

  return [...byId.values()]
}
