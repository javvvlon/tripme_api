/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface SamoQuery {
  params: Record<string, string>
  baseUrl: string
}

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

  priceSource: string
  currencySource: string
  priceShown: string
  currencyShown: string

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

  flags: string
}
