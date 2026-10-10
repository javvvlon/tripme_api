import { describe, expect, it } from 'vitest'
import { parseHotelCatalog } from './samo.catalog'
import { buildBookingUrl } from './samo.map'
import type { SamoRow } from './samo.contracts'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const page = `<script>samo.ROOT_URL = "\\/search_tour?";samo.hotelDynamic = [
  {"id":751428,"name":"Gaia Hotel Phu Quoc","starKey":6,"star":"3*","townKey":293967,"starGroupList":"10003","nameAlt":"Gaia [new] \\"wing\\""},
  {"id":-2269372,"name":"Gaia Hotel PhuQuoc","townKey":null,"starGroupList":null}
];samo.other = [1,2];</script>`

const row = (over: Partial<SamoRow> = {}): SamoRow => ({
  townfrom: '708693', state: '293645', statefrom: '708675', checkin: '20261007', nights: '7',
  hotel: '751428', tour: '26731', meal: '1263', room: '43553', htplace: '1',
  currencySource: '2', ...over,
} as SamoRow)

describe('samo hotel catalog', () => {
  it('reads each hotel name, city and category from the search page', () => {
    const catalog = parseHotelCatalog(page)

    expect(catalog.get('751428')).toEqual({ town: '293967', stars: '10003', name: 'Gaia Hotel Phu Quoc', starCount: 3 })
    expect(catalog.get('-2269372')).toEqual({ town: '', stars: '', name: 'Gaia Hotel PhuQuoc', starCount: null })
  })

  it('returns nothing for a page without the catalog', () => {
    expect(parseHotelCatalog('<html></html>').size).toBe(0)
  })
})

describe('samo booking link', () => {
  it('opens the operator form on the city, category and hotel of the offer', () => {
    const url = new URL(buildBookingUrl(row({ townKey: '293967', starKey: '10003' }), 'https://b2b.fstravel.asia/search_tour', 1, 0))

    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      CHECKIN_BEG: '07.10.2026',
      CHECKIN_END: '07.10.2026',
      NIGHTS_FROM: '7',
      NIGHTS_TILL: '7',
      ADULT: '1',
      TOWNS: '293967',
      STARS: '10003',
      HOTELS: '751428',
    })
    expect(url.searchParams.has('HOTELS_ANY')).toBe(false)
    expect(url.searchParams.has('hotelsearch')).toBe(false)
  })

  it('still names the hotel when the catalog is unavailable', () => {
    const url = new URL(buildBookingUrl(row(), 'https://b2b.fstravel.asia/search_tour', 2, 0))

    expect(url.searchParams.get('HOTELS')).toBe('751428')
    expect(url.searchParams.has('TOWNS')).toBe(false)
  })
})
