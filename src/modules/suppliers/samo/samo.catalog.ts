import { parse as parseHtml } from 'node-html-parser'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface ISamoTown {
  name: string
  region: string
}

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

const TOWNS_MARKER = 'checklistbox TOWNS'

const textOf = (value: string | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim()

export function parseTowns(html: string): Map<string, ISamoTown> {
  const towns = new Map<string, ISamoTown>()
  const marker = html.indexOf(TOWNS_MARKER)

  if (marker === -1) return towns

  const start = html.lastIndexOf('<div', marker)
  const end = html.indexOf('checklistbox HOTELS', marker)
  const box = parseHtml(html.slice(start, end === -1 ? undefined : html.lastIndexOf('<div', end))).querySelector('.checklistbox.TOWNS')

  if (!box) return towns

  for (const input of box.querySelectorAll('input[value]')) {
    const code = input.getAttribute('value') ?? ''
    const name = textOf(input.parentNode?.text)
    const group = input.closest('.groupbox')
    const region = textOf(group?.querySelector('.groupname')?.text) || name

    if (code && name) towns.set(code, { name, region })
  }

  return towns
}
