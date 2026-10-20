import { BadRequestException } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { randomUUID } from 'node:crypto'
import { AD_BACKDROPS, AD_BUTTONS, AD_INCLUDES, AD_LANGUAGES, AD_MOODS, AD_STYLES, DEFAULT_DESIGN, POST_STYLES } from './selection.entity'
import type { AdBackdrop, AdButtons, AdInclude, AdLanguage, AdMood, AdStyle, IAdContact, IAdDesign, IAdLeg, IAdTour, PostStyle } from './selection.entity'
import { usernameOf } from './telegram.publisher'
import { isHotDeparture } from '~/modules/search/hot'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const MAX_TOURS = 6

export const CODE_LENGTH = 7

export const MAX_CONTACTS = 12

export const MAX_BUTTONS = 4

export const MAX_BACKGROUNDS = 8

const CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const TEXT_FIELDS: Record<string, number> = {
  hotel_name: 240,
  hotel_code: 120,
  hotel_url: 600,
  booking_url: 1200,
  supplier_id: 60,
  supplier_name: 120,
  offer_id: 400,
  meal_code: 40,
  meal_plan: 16,
  meal_name: 120,
  room_name: 160,
  district: 120,
  availability: 24,
  programme: 2000,
  fare: 120,
  price_currency: 8,
  price_uzs_basis: 16,
  route_from: 120,
  route_to: 120,
  route_to_label: 120,
  source: 16,
  post_basis: 16,
}

const NUMBER_FIELDS = ['hotel_stars', 'price_uzs', 'price_uzs_rate'] as const

export function newCode(): string {
  const bytes = randomBytes(CODE_LENGTH)

  return Array.from(bytes, byte => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')
}

export const isCode = (value: string): boolean =>
  value.length === CODE_LENGTH && [...value].every(char => CODE_ALPHABET.includes(char))

const textOf = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''

const countOf = (value: unknown, max = 99): number => {
  const n = Math.floor(Number(value))

  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0
}

export function tourOf(raw: unknown): IAdTour | null {
  if (!raw || typeof raw !== 'object') return null

  const input = raw as Record<string, unknown>
  const hotel = textOf(input.hotel_name, 240)
  const checkIn = textOf(input.check_in, 10)
  const amount = Number(input.price_amount)

  if (!hotel || !ISO_DATE.test(checkIn) || !Number.isFinite(amount) || amount <= 0) return null

  const tour: IAdTour = {
    offer_id: textOf(input.offer_id, 400) || `${hotel}|${checkIn}`,
    hotel_name: hotel,
    check_in: checkIn,
    nights: countOf(input.nights, 60),
    adults: countOf(input.adults, 12) || 2,
    children: countOf(input.children, 8),
    price_amount: Math.round(amount * 100) / 100,
    price_currency: textOf(input.price_currency, 8) || 'USD',
  }

  for (const [key, max] of Object.entries(TEXT_FIELDS)) {
    if (key in tour) continue

    const value = textOf(input[key], max)

    if (value) tour[key] = value
  }

  for (const key of NUMBER_FIELDS) {
    const value = Number(input[key])

    if (Number.isFinite(value) && value > 0) tour[key] = value
  }

  if (typeof input.refundable === 'boolean') tour.refundable = input.refundable
  if (input.tier === true && Number(tour.hotel_stars) > 0) tour.tier = true

  const legs = legsOf(input.legs)

  if (legs.length) tour.legs = legs

  const countries = Array.isArray(input.countries) ? [...new Set(input.countries.filter((slug): slug is string => typeof slug === 'string' && /^[a-z][a-z-]{1,40}$/.test(slug)))].slice(0, MAX_LEGS) : []

  if (countries.length) tour.countries = countries

  if (Array.isArray(input.kid_ages)) {
    tour.kid_ages = input.kid_ages.map(Number).filter(age => Number.isInteger(age) && age >= 0 && age < 18).slice(0, tour.children)
  }

  return tour
}

export const MAX_LEGS = 6

export const MAX_INCLUDES = 8

export function legsOf(raw: unknown): IAdLeg[] {
  if (!Array.isArray(raw)) return []

  return raw.flatMap((item) => {
    const input = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    const place = textOf(input.place, 60)

    return place ? [{ place, nights: countOf(input.nights, 60), hotel: textOf(input.hotel, 120) }] : []
  }).slice(0, MAX_LEGS)
}

export function includesOf(raw: unknown): AdInclude[] {
  if (!Array.isArray(raw)) return []

  return AD_INCLUDES.filter(key => raw.includes(key)).slice(0, MAX_INCLUDES)
}

export const isOwn = (tour: IAdTour): boolean => tour.source === 'own'

const EDITABLE = ['hotel_name', 'hotel_stars', 'tier', 'meal_plan', 'district', 'check_in', 'nights', 'price_amount', 'price_currency', 'legs'] as const

const sameEdit = (a: IAdTour, b: IAdTour): boolean => EDITABLE.every(key => JSON.stringify(a[key] ?? null) === JSON.stringify(b[key] ?? null))

export function editedTours(raw: unknown, current: IAdTour[]): IAdTour[] {
  if (!Array.isArray(raw)) throw new BadRequestException('tours must be a list')

  const known = new Map(current.map(tour => [tour.offer_id, tour]))
  const next: IAdTour[] = []

  for (const item of raw) {
    const input = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    const id = typeof input.offer_id === 'string' ? input.offer_id : ''
    const stored = known.get(id)

    if (stored && stored.source !== 'own' && stored.source !== 'post') {
      next.push(stored)
      continue
    }

    const tour = tourOf({ ...stored, ...input, meal_code: input.meal_plan ?? stored?.meal_code, offer_id: id || `own:${randomUUID().slice(0, 16)}` })

    if (!tour) throw new BadRequestException('Every line needs a name, a departure date and a price')

    next.push(stored && sameEdit(tour, stored) ? stored : { ...tour, source: 'own', check_state: undefined, check_was: null })
  }

  const unique = [...new Map(next.map(tour => [tour.offer_id, tour])).values()].slice(0, MAX_TOURS)

  if (!unique.length) throw new BadRequestException('A selection needs at least one tour')

  return unique
}

export function toursOf(raw: unknown): IAdTour[] {
  if (!Array.isArray(raw)) return []

  const seen = new Set<string>()
  const tours: IAdTour[] = []

  for (const item of raw) {
    const tour = tourOf(item)

    if (!tour || seen.has(tour.offer_id)) continue

    seen.add(tour.offer_id)
    tours.push(tour)

    if (tours.length === MAX_TOURS) break
  }

  return tours
}

export const styleOf = (value: unknown): AdStyle | null =>
  AD_STYLES.includes(value as AdStyle) ? value as AdStyle : null

export const languagesOf = (value: unknown): AdLanguage[] => {
  const list = Array.isArray(value) ? value : [value]
  const picked = AD_LANGUAGES.filter(language => list.includes(language))

  return picked.length ? picked : [...AD_LANGUAGES]
}

export function destinationOf(tours: IAdTour[]): string {
  const label = tours.map(tour => textOf(tour.route_to_label, 120)).find(Boolean)

  return label || tours.map(tour => textOf(tour.route_to, 120)).find(Boolean) || ''
}

export function resortsOf(tours: IAdTour[]): string[] {
  return [...new Set(tours.map(tour => textOf(tour.district, 120)).filter(Boolean))].slice(0, 3)
}

export function titleOf(tours: IAdTour[]): string {
  return (destinationOf(tours) || tours[0]?.hotel_name || '').slice(0, 120)
}

export function isHot(tours: IAdTour[], today: string): boolean {
  return tours.length > 0 && tours.every(tour =>
    isHotDeparture(tour.check_in, tour.check_state === 'gone' || tour.availability === 'stopped', today))
}

export const cheapestOf = (tours: IAdTour[]): IAdTour | null =>
  tours.reduce<IAdTour | null>((best, tour) => (!best || tour.price_amount < best.price_amount ? tour : best), null)

export const liveTours = (tours: IAdTour[]): IAdTour[] =>
  tours.filter(tour => tour.check_state !== 'gone')

const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Math.round(Number(value))

  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

export function designOf(raw: unknown, current: Partial<IAdDesign> = {}): IAdDesign {
  const base = { ...DEFAULT_DESIGN, ...current }
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const flag = (key: 'stars' | 'meal' | 'party' | 'cta' | 'caps' | 'footer'): boolean =>
    typeof input[key] === 'boolean' ? input[key] as boolean : base[key]

  return {
    backdrop: AD_BACKDROPS.includes(input.backdrop as AdBackdrop)
      ? input.backdrop as AdBackdrop
      : AD_BACKDROPS.includes(base.backdrop) ? base.backdrop : DEFAULT_DESIGN.backdrop,
    dim: clamp(input.dim ?? base.dim, 0, 90, DEFAULT_DESIGN.dim),
    focus: clamp(input.focus ?? base.focus, 0, 100, DEFAULT_DESIGN.focus),
    rows: clamp(input.rows ?? base.rows, 1, MAX_TOURS, DEFAULT_DESIGN.rows),
    stars: flag('stars'),
    meal: flag('meal'),
    party: flag('party'),
    cta: flag('cta'),
    caps: flag('caps'),
    price: input.price === 'person' || input.price === 'total' ? input.price : base.price,
    hotel: typeof input.hotel === 'string' ? input.hotel.slice(0, 400) : base.hotel,
    footer: flag('footer'),
    buttons: AD_BUTTONS.includes(input.buttons as AdButtons) ? input.buttons as AdButtons : base.buttons,
    mood: AD_MOODS.includes(input.mood as AdMood) ? input.mood as AdMood : AD_MOODS.includes(base.mood) ? base.mood : DEFAULT_DESIGN.mood,
    post_style: POST_STYLES.includes(input.post_style as PostStyle) ? input.post_style as PostStyle : POST_STYLES.includes(base.post_style) ? base.post_style : DEFAULT_DESIGN.post_style,
  }
}

export function contactsOf(raw: unknown): IAdContact[] {
  if (!Array.isArray(raw)) return []

  const contacts: IAdContact[] = []

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue

    const input = item as Record<string, unknown>
    const name = textOf(input.name, 40)
    const telegram = usernameOf(input.telegram)

    if (!name || !telegram) continue

    const id = typeof input.id === 'string' && /^[0-9a-f-]{36}$/i.test(input.id) ? input.id : randomUUID()

    if (contacts.some(contact => contact.id === id)) continue

    contacts.push({ id, name, telegram })

    if (contacts.length === MAX_CONTACTS) break
  }

  return contacts
}

export function pickedContacts(raw: unknown, known: IAdContact[]): string[] {
  if (!Array.isArray(raw)) return []

  const ids = new Set(known.map(contact => contact.id))

  return [...new Set(raw.map(String))].filter(id => ids.has(id)).slice(0, MAX_BUTTONS)
}
