import { createHash } from 'node:crypto'
import { Availability } from '~/modules/search/contracts/search'
import { hotelKey } from '~/modules/search/hotel-key'
import { MEAL_PLANS } from '~/modules/search/meal-plans'
import type { IOffer } from '~/modules/search/models/Offer'
import type { ReferenceItem } from '~/modules/suppliers/dictionary/dictionary.contracts'
import type { IAdTour } from '../selection.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const MAX_POST_CHARS = 4000

export const MAX_POST_HOTELS = 12

export const MAX_POST_DATES = 6

export const MAX_SEARCH_DATES = 3

export const POST_ADULTS = 2

export const POST_CURRENCIES = ['USD', 'EUR', 'UZS'] as const

export type PostCurrency = typeof POST_CURRENCIES[number]

export type PostBasis = 'person' | 'total' | ''

export type PostMeal = Exclude<typeof MEAL_PLANS[number], 'PROGRAM'>

const POST_MEALS: readonly PostMeal[] = ['RO', 'BB', 'HB', 'FB', 'AI', 'UAI']

export interface IPostHotel {
  name: string
  stars: number | null
  district: string
  meal: PostMeal | ''
  price: number | null
  currency: PostCurrency | ''
}

export interface IPostLeg {
  place: string
  country: string
  nights: number | null
  hotel: string
}

export interface IPostFacts {
  country: string
  from: string
  dates: string[]
  nights: number | null
  basis: PostBasis
  operator: string
  airline: string
  hotels: IPostHotel[]
  own: boolean
  legs: IPostLeg[]
  price: number | null
  currency: PostCurrency | ''
  includes: string[]
}

export type SkipReason = 'no_price' | 'no_date' | 'no_nights' | 'limit'

export interface IIntakeReport {
  country: string
  operator: string
  found: number
  kept: number
  skipped: Array<{ hotel: string, reason: SkipReason }>
  own?: boolean
}

export interface IIntakeRoute {
  from: string
  to: string
  toLabel: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const INCLUDE_KEYS = ['flight', 'hotel', 'breakfast', 'meals', 'transfer', 'insurance', 'visa', 'excursions', 'guide']

const HAS_EMOJI = /\p{Extended_Pictographic}/u

const DAY_MS = 86_400_000

const plain = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''

const numberOf = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value.replace(/[\s,]/g, '')) : Number(value)

  return Number.isFinite(n) && n > 0 ? n : null
}

export const normalised = (value: string): string =>
  value.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, '')

export const addDays = (day: string, count: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + count * DAY_MS).toISOString().slice(0, 10)

export function labelMatch(value: string, items: ReferenceItem[]): ReferenceItem | null {
  const wanted = normalised(value)

  if (!wanted) return null

  return items.find(item => normalised(item.label) === wanted || normalised(item.slug) === wanted)
    ?? items.find(item => normalised(item.label).startsWith(wanted) || wanted.startsWith(normalised(item.label)))
    ?? null
}

export const INTAKE_RULES = [
  'You read tour offers that tour operators in Uzbekistan post in Telegram (Russian, Uzbek or English) and return only the facts the post states, as JSON.',
  'Never guess. When the post does not say something, leave it empty: "" for text, null for numbers, [] for lists.',
  'country: exactly one name from the allowed countries list, or "" when the post does not make it clear. A city or resort implies its country (Дубай → ОАЭ, Анталья → Турция, Бентота → Шри-Ланка, Пхукет → Таиланд, Шарм-эль-Шейх → Египет, Фукуок → Вьетнам, Нячанг → Вьетнам, Бали → Индонезия). A flag emoji implies its country (🇻🇳 → Вьетнам, 🇹🇷 → Турция). Posts are often in Uzbek Latin: Fukuok = Фукуок, Vyetnam = Вьетнам, Turkiya = Турция, BAA = ОАЭ, Misr = Египет, Tailand = Таиланд, Gruziya = Грузия, Malayziya = Малайзия, Indoneziya = Индонезия, Singapur = Сингапур, Shri-Lanka = Шри-Ланка, Maldiv orollari = Мальдивы.',
  'from: the departure city in Russian when the post states it (Ташкент, Самарканд, Фергана, Бухара, Ургенч, Наманган), else "".',
  'dates: departure dates as YYYY-MM-DD. A date without a year is the next such date on or after today. A range like «12–19 ноября» is a departure on the 12th. At most 6 dates.',
  'nights: the number of nights when stated or derivable from a date range, else null.',
  'hotels: every hotel the post offers. name: the hotel name only, without stars, city, region or meal plan. stars: 1–5 or null. district: the resort, city or area given for that hotel, else "". meal: RO, BB, HB, FB, AI, UAI or "" (без питания = RO, завтрак = BB, полупансион = HB, полный пансион = FB, всё включено = AI, ультра всё включено = UAI). price: the number given for that hotel, or the post\'s single «от …» price when it gives one price for all, else null. currency: USD, EUR or UZS ($ and у.е. = USD, сум = UZS), else "".',
  'basis: "person" when prices are per person (за человека, /чел, при 2-местном размещении, per person), "total" when for the whole room or for two together, else "".',
  'operator: the tour operator\'s name when it appears (a signature, the channel it was forwarded from, an @handle such as @kompastour → Kompas Tour), else "".',
  'airline: the airline when stated, else "".',
  'own: true when the staff member says this is TripMe\'s own offer (наше предложение, свой тур, our own, bizning taklif) or asks to post their own prices, and also when the offer has no specific hotels (only star categories) or is a route through several places. Else false.',
  'Star categories without a hotel name, like «3* mehmonxona — $570» or «Отель 4* — 675$», are hotels with name "" and the stars.',
  'legs: for a route through several places, every stop in order: place (the city, in the post\'s language), country (one allowed country name or ""), nights, hotel (name or ""). Else [].',
  'price and currency: the single total price of a route offer when it has one price for the whole route, else null and "".',
  'includes: what the price includes, as keys from this list only: flight, hotel, breakfast, meals, transfer, insurance, visa, excursions, guide (Aviachipta/перелёт = flight, Mehmonxona/отель = hotel, Nonushta/завтраки = breakfast, Tibbiy sug‘urta/страховка = insurance). Else [].',
  'For a route, country is the first country of the route.',
  'Ignore phone numbers, managers\' @usernames and links. Return JSON only.',
].join('\n')

export function intakePrompt(input: { text: string, origin: string, countries: string[], today: string, image: boolean }): string {
  const shape = {
    country: '', from: '', dates: [], nights: null, basis: '', operator: '', airline: '',
    hotels: [{ name: '', stars: null, district: '', meal: '', price: null, currency: '' }],
    own: false, legs: [{ place: '', country: '', nights: null, hotel: '' }], price: null, currency: '', includes: [],
  }

  return [
    `Today is ${input.today}.`,
    `Allowed countries: ${input.countries.join(', ')}`,
    `Return exactly this JSON shape: ${JSON.stringify(shape)}`,
    input.origin ? `The post was forwarded from: ${input.origin}` : '',
    input.image ? 'The attached screenshot belongs to the same offer; read it as part of the post.' : '',
    `Post:\n"""\n${input.text.slice(0, MAX_POST_CHARS) || '(no text, read the screenshot)'}\n"""`,
  ].filter(Boolean).join('\n')
}

function hotelOf(raw: unknown): IPostHotel | null {
  if (!raw || typeof raw !== 'object') return null

  const input = raw as Record<string, unknown>
  const name = plain(input.name, 120).replace(/\s*\d\s*(\*+|★+)\s*$/u, '').trim()
  const stars = Math.round(Number(input.stars))

  if (HAS_EMOJI.test(name) || (name.length < 2 && !(stars >= 1 && stars <= 5))) return null

  const meal = plain(input.meal, 4).toUpperCase()
  const currency = plain(input.currency, 4).toUpperCase()
  const price = numberOf(input.price)

  return {
    name: name.length < 2 ? '' : name,
    stars: stars >= 1 && stars <= 5 ? stars : null,
    district: HAS_EMOJI.test(plain(input.district, 80)) ? '' : plain(input.district, 80),
    meal: POST_MEALS.includes(meal as PostMeal) ? meal as PostMeal : '',
    price: price && price < 1e10 ? Math.round(price * 100) / 100 : null,
    currency: POST_CURRENCIES.includes(currency as PostCurrency) ? currency as PostCurrency : '',
  }
}

export function postFactsOf(raw: unknown, context: { countries: ReferenceItem[], today: string }): IPostFacts {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const latest = addDays(context.today, 400)
  const dates = [...new Set((Array.isArray(input.dates) ? input.dates : [])
    .map(value => plain(value, 10))
    .filter(day => ISO_DATE.test(day) && !Number.isNaN(Date.parse(day)) && day >= context.today && day <= latest))]
    .sort()
    .slice(0, MAX_POST_DATES)
  const nights = Math.round(Number(input.nights))
  const basis = plain(input.basis, 8)
  const hotels: IPostHotel[] = []
  const seen = new Set<string>()

  for (const item of Array.isArray(input.hotels) ? input.hotels : []) {
    const hotel = hotelOf(item)
    const key = hotel ? hotelKey(hotel.name) || `tier${hotel.stars}` : ''

    if (!hotel || !key || seen.has(key)) continue

    seen.add(key)
    hotels.push(hotel)

    if (hotels.length === MAX_POST_HOTELS) break
  }

  return {
    country: labelMatch(plain(input.country, 80), context.countries)?.label ?? '',
    from: plain(input.from, 40),
    dates,
    nights: nights >= 1 && nights <= 60 ? nights : null,
    basis: basis === 'person' || basis === 'total' ? basis : '',
    operator: plain(input.operator, 80),
    airline: plain(input.airline, 60),
    hotels,
    own: input.own === true,
    legs: legsOfPost(input.legs, context.countries),
    price: numberOf(input.price),
    currency: POST_CURRENCIES.includes(plain(input.currency, 4).toUpperCase() as PostCurrency) ? plain(input.currency, 4).toUpperCase() as PostCurrency : '',
    includes: INCLUDE_KEYS.filter(key => (Array.isArray(input.includes) ? input.includes : []).map(item => plain(item, 20).toLowerCase()).includes(key)),
  }
}

function legsOfPost(raw: unknown, countries: ReferenceItem[]): IPostLeg[] {
  if (!Array.isArray(raw)) return []

  return raw.flatMap((item) => {
    const input = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    const place = plain(input.place, 60)
    const nights = Math.round(Number(input.nights))

    if (!place || HAS_EMOJI.test(place)) return []

    return [{
      place,
      country: labelMatch(plain(input.country, 80), countries)?.label ?? '',
      nights: nights >= 1 && nights <= 60 ? nights : null,
      hotel: plain(input.hotel, 120),
    }]
  }).slice(0, 6)
}

export const isOwnOffer = (facts: IPostFacts): boolean =>
  facts.own || facts.legs.length > 1 || (facts.hotels.length > 0 && facts.hotels.every(hotel => !hotel.name))

export function ownTours(facts: IPostFacts, route: IIntakeRoute | null, slugs: string[]): { tours: IAdTour[], skipped: Array<{ hotel: string, reason: SkipReason }> } {
  const checkIn = facts.dates[0] ?? ''
  const legNights = facts.legs.reduce((sum, leg) => sum + (leg.nights ?? 0), 0)
  const nights = facts.nights ?? (legNights || null)
  const total = (price: number) => Math.round((facts.basis === 'total' ? price : price * POST_ADULTS) * 100) / 100
  const districts = [...new Set(facts.hotels.map(hotel => hotel.district).filter(Boolean))]
  const label = facts.legs.length > 1 ? facts.legs.map(leg => leg.place).join(' · ') : districts.length === 1 && districts[0] ? districts[0] : route?.toLabel || facts.country
  const base = {
    check_in: checkIn,
    nights: nights ?? 0,
    adults: POST_ADULTS,
    children: 0,
    supplier_name: undefined,
    route_from: route?.from || undefined,
    route_to: route?.to || slugs[0] || undefined,
    route_to_label: label || undefined,
    countries: slugs.length ? slugs : undefined,
    source: 'own',
    post_basis: facts.basis || 'unknown',
  }
  const gap = (price: number | null): SkipReason | null => (!price ? 'no_price' : !checkIn ? 'no_date' : !nights ? 'no_nights' : null)
  const tours: IAdTour[] = []
  const skipped: Array<{ hotel: string, reason: SkipReason }> = []
  const id = (parts: Array<string | number>) => `own:${createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 16)}`

  if (facts.legs.length > 1 && facts.price) {
    const reason = gap(facts.price)

    if (reason) skipped.push({ hotel: label, reason })
    else {
      tours.push({
        ...base,
        offer_id: id([label, checkIn, nights ?? '', facts.price]),
        hotel_name: label,
        legs: facts.legs.map(leg => ({ place: leg.place, nights: leg.nights ?? 0, hotel: leg.hotel })),
        price_amount: total(facts.price),
        price_currency: facts.currency || 'USD',
      })
    }
  }

  for (const hotel of facts.hotels) {
    const price = hotel.price ?? (facts.hotels.length === 1 ? facts.price : null)
    const name = hotel.name || `${hotel.stars}*`
    const reason = gap(price)

    if (reason || !price) {
      skipped.push({ hotel: name, reason: reason ?? 'no_price' })
      continue
    }

    tours.push({
      ...base,
      offer_id: id([name, checkIn, nights ?? '', price]),
      hotel_name: name,
      hotel_stars: hotel.stars ?? undefined,
      tier: !hotel.name && Boolean(hotel.stars),
      meal_code: hotel.meal || undefined,
      meal_plan: hotel.meal || undefined,
      district: hotel.district || undefined,
      price_amount: total(price),
      price_currency: hotel.currency || facts.currency || 'USD',
    })
  }

  return { tours, skipped }
}

export function searchDates(facts: IPostFacts, today: string, horizon = 7): Array<{ dateFrom: string, dateTo: string }> {
  if (facts.dates.length) return facts.dates.slice(0, MAX_SEARCH_DATES).map(day => ({ dateFrom: day, dateTo: day }))

  const start = addDays(today, 1)

  return [{ dateFrom: start, dateTo: addDays(start, horizon - 1) }]
}

const supplierMatches = (offer: IOffer, operator: string): boolean => {
  const wanted = normalised(operator).replace(/(tour|travel|тур|трэвел)$/u, '')

  return Boolean(wanted) && normalised(offer.supplier.name).includes(wanted)
}

export function pickOffer(key: string, hotel: IPostHotel, operator: string, offers: Array<IOffer & { mealPlan?: string | null }>, price: (offer: IOffer) => number): (IOffer & { mealPlan?: string | null }) | null {
  const same = offers.filter(offer =>
    hotelKey(offer.hotelName) === key
    && offer.availability !== Availability.Stopped
    && (!hotel.meal || offer.mealPlan === hotel.meal))

  if (!same.length) return null

  const score = (offer: IOffer & { mealPlan?: string | null }) => (supplierMatches(offer, operator) ? 1 : 0)

  return same.reduce((best, offer) => {
    const diff = score(offer) - score(best)

    return diff > 0 || (diff === 0 && price(offer) < price(best)) ? offer : best
  })
}

export function tourFromOffer(offer: IOffer & { mealPlan?: string | null }, route: IIntakeRoute): IAdTour {
  return {
    offer_id: offer.id,
    hotel_name: offer.hotelName,
    hotel_stars: offer.hotelStars ?? undefined,
    hotel_code: offer.hotelSupplierCode || undefined,
    hotel_url: offer.hotelUrl ?? undefined,
    booking_url: offer.bookingUrl ?? undefined,
    supplier_id: offer.supplier.id,
    supplier_name: offer.supplier.name,
    check_in: offer.checkIn,
    nights: offer.nights,
    adults: offer.adults,
    children: offer.children,
    meal_code: offer.mealCode ?? undefined,
    meal_plan: offer.mealPlan ?? undefined,
    meal_name: offer.mealName ?? undefined,
    room_name: offer.roomName ?? undefined,
    district: offer.district ?? undefined,
    availability: offer.availability,
    refundable: offer.refundable ?? undefined,
    programme: offer.programme ?? undefined,
    fare: offer.fare ?? undefined,
    price_amount: Math.round(offer.price.source.amount * 100) / 100,
    price_currency: offer.price.source.currency,
    price_uzs: offer.price.uzs?.amount ?? undefined,
    price_uzs_basis: offer.price.uzs?.basis ?? undefined,
    price_uzs_rate: offer.price.uzs?.rate ?? undefined,
    route_from: route.from,
    route_to: route.to,
    route_to_label: route.toLabel,
    source: 'search',
  }
}

export function postGap(hotel: IPostHotel, facts: IPostFacts): SkipReason | null {
  if (!hotel.price) return 'no_price'
  if (!facts.dates.length) return 'no_date'
  if (!facts.nights) return 'no_nights'

  return null
}

export function tourFromPost(hotel: IPostHotel, facts: IPostFacts, route: IIntakeRoute | null): IAdTour | null {
  const checkIn = facts.dates[0]
  const nights = facts.nights

  if (postGap(hotel, facts) || !hotel.price || !checkIn || !nights) return null

  const total = facts.basis === 'total' ? hotel.price : hotel.price * POST_ADULTS
  const id = createHash('sha1').update([hotelKey(hotel.name), checkIn, nights, hotel.price].join('|')).digest('hex').slice(0, 16)

  return {
    offer_id: `post:${id}`,
    hotel_name: hotel.name,
    hotel_stars: hotel.stars ?? undefined,
    supplier_name: facts.operator || undefined,
    check_in: checkIn,
    nights,
    adults: POST_ADULTS,
    children: 0,
    meal_code: hotel.meal || undefined,
    meal_plan: hotel.meal || undefined,
    district: hotel.district || undefined,
    price_amount: Math.round(total * 100) / 100,
    price_currency: hotel.currency || 'USD',
    route_from: route?.from || undefined,
    route_to: route?.to || undefined,
    route_to_label: route?.toLabel || facts.country || undefined,
    source: 'post',
    post_basis: facts.basis || 'unknown',
  }
}

const FLAG_COUNTRIES: Record<string, string> = {
  AZ: 'azerbaijan', AM: 'armenia', GB: 'velikobritaniya', HU: 'vengriya', VN: 'vietnam', DE: 'germaniya', GE: 'georgia', EG: 'egypt',
  IN: 'india', ID: 'indonesia', ES: 'spain', IT: 'italy', KZ: 'kazakhstan', QA: 'qatar', KE: 'keniya', CN: 'china', MU: 'mauritius',
  MY: 'malaysia', MV: 'maldives', MA: 'marokko', AE: 'uae', OM: 'oman', PL: 'polsha', SA: 'saudovskaya-araviya', SC: 'seychelles',
  SG: 'singapore', US: 'ssha', TH: 'thailand', TZ: 'tanzaniya', TR: 'turkey', FR: 'frantsiya', CZ: 'czechia', CH: 'shveytsariya',
  LK: 'srilanka', KR: 'yuzhnaya-koreya', JP: 'japan',
}

export function flagCountries(text: string, countries: ReferenceItem[]): ReferenceItem[] {
  const found: ReferenceItem[] = []

  for (const match of text.matchAll(/([\u{1F1E6}-\u{1F1FF}])([\u{1F1E6}-\u{1F1FF}])/gu)) {
    const code = [...match[0]].map(char => String.fromCharCode((char.codePointAt(0) ?? 0) - 0x1F1E6 + 65)).join('')
    const item = countries.find(country => country.slug === FLAG_COUNTRIES[code])

    if (item && !found.includes(item)) found.push(item)
  }

  return found
}
