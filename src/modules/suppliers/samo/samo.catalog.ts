/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface ISamoHotelPlace {
  town: string
  stars: string
  name: string
  starCount: number | null
}

interface IRawHotel {
  id?: number | string
  name?: string | null
  star?: string | null
  townKey?: number | string | null
  starGroupList?: string | null
}

const MARKER = 'samo.hotelDynamic'

function arrayAfter(text: string, from: number): string | null {
  const start = text.indexOf('[', from)
  if (start === -1) return null

  let depth = 0
  let quoted = false

  for (let i = start; i < text.length; i++) {
    const char = text[i]

    if (quoted) {
      if (char === '\\') i++
      else if (char === '"') quoted = false
      continue
    }

    if (char === '"') quoted = true
    else if (char === '[') depth++
    else if (char === ']' && --depth === 0) return text.slice(start, i + 1)
  }

  return null
}

export function parseHotelCatalog(html: string): Map<string, ISamoHotelPlace> {
  const catalog = new Map<string, ISamoHotelPlace>()
  const at = html.indexOf(MARKER)

  if (at === -1) return catalog

  const raw = arrayAfter(html, at)
  if (!raw) return catalog

  let hotels: IRawHotel[]

  try {
    hotels = JSON.parse(raw) as IRawHotel[]
  }
  catch {
    return catalog
  }

  for (const hotel of hotels) {
    if (hotel.id === undefined || hotel.id === null) continue

    catalog.set(String(hotel.id), {
      town: hotel.townKey === undefined || hotel.townKey === null ? '' : String(hotel.townKey),
      stars: (hotel.starGroupList ?? '').split(',')[0]?.trim() ?? '',
      name: typeof hotel.name === 'string' ? hotel.name.trim() : '',
      starCount: /^[1-5]/.test(hotel.star ?? '') ? Number((hotel.star ?? '')[0]) : null,
    })
  }

  return catalog
}
