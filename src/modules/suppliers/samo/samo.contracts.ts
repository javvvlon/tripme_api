/**
 * SAMO's own vocabulary. Nothing outside this folder may import these types.
 *
 * SAMO is a booking platform used by many operators, so this layer is the
 * protocol; an operator (Kompas, ANEX) is a config on top of it.
 *
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface SamoQuery {
  params: Record<string, string>
  baseUrl: string
}

/**
 * One `<tr>` from the PRICESGROUP payload, already unescaped and read.
 *
 * Field names mirror SAMO's `data-*` attributes rather than ours on purpose:
 * this is the boundary, and blurring it here is how supplier vocabulary leaks
 * into the rest of the app.
 */
export interface SamoRow {
  townfrom: string
  state: string
  checkin: string
  nights: string
  hotel: string
  statefrom: string
  tour: string
  meal: string
  room: string
  htplace: string

  hotelName: string
  hotelUrl: string
  hotelSlug: string
  district: string
  stars: string

  /** the operator's own price and currency — the source of truth */
  priceSource: string
  currencySource: string
  /** SAMO's own conversion; recorded, never trusted */
  priceShown: string
  currencyShown: string

  /** 'stop' | 'bron' — whether the row can be booked at all */
  saleState: string
  stopReason: string
  availabilityCode: string
  availabilityText: string
  flightCode: string
  flightText: string

  tourName: string
  fare: string
  mealText: string
  roomText: string

  /** row css classes: red_row marks a stop-sale */
  flags: string
}
