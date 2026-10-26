import type { ReferenceItem } from '~/modules/suppliers/dictionary/dictionary.contracts'
import { addDays, labelMatch } from '~/modules/marketing/intake/post'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const MAX_RANGE_DAYS = 7

export const DEFAULT_ADULTS = 2

export const DEFAULT_KID_AGE = 7

export const MAX_ADULTS = 6

export const MAX_KIDS = 4

export const ROOM_PEOPLE = 5

export const MAX_ASKED_HOTELS = 4

export const MAX_CANDIDATES = 4

export const MAX_PLAN_HOTELS = 8

const MAX_TEXT = 2000

const LEAD_MEALS = ['RO', 'BB', 'HB', 'FB', 'AI', 'UAI'] as const

export type LeadMeal = typeof LEAD_MEALS[number]

const BUDGET_CURRENCIES = ['USD', 'EUR', 'UZS'] as const

const LANGUAGES: Record<string, string> = { ru: 'Russian', uz: 'Uzbek (Latin script)', en: 'English' }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export interface IAskedHotel {
  asked: string
  latin: string
  candidates: string[]
  stars: number | null
}

export interface ILeadBudget {
  amount: number
  currency: string
  basis: 'person' | 'total' | ''
}

export interface ILeadSearchFacts {
  country: string
  resort: string
  from: string
  dateFrom: string
  dateTo: string
  nights: number | null
  adults: number | null
  kidAges: Array<number | null>
  hotels: IAskedHotel[]
  stars: number[]
  meals: LeadMeal[]
  budget: ILeadBudget | null
  note: string
}

export interface ILeadRequest {
  comment: string
  destination: string
  plannedDates: string
  adults: number
  childrenAges: number[]
  budgetAmount: number | null
  budgetCurrency: string
}

export interface IPlanPlace {
  slug: string
  label: string
}

export interface IPlanHotel {
  key: string
  name: string
  stars: number | null
}

export interface ILeadSearchPlan {
  from: IPlanPlace | null
  to: IPlanPlace | null
  country: string
  resort: string
  date_from: string
  date_to: string
  dates_assumed: boolean
  nights: number | null
  adults: number
  kid_ages: number[]
  ages_assumed: boolean
  crowded: boolean
  hotels: IPlanHotel[]
  missing_hotels: string[]
  stars: number[]
  meals: LeadMeal[]
  budget: ILeadBudget | null
  note: string
}

export const LEAD_SEARCH_RULES = [
  'You help a travel agent in Uzbekistan. You read what a client asked for (Russian, Uzbek or English, often short and informal) and turn it into one package-tour search. Return only JSON.',
  'Use only what the client\'s words and the agent fields say, plus common knowledge of resorts, holidays and hotel chains. Leave anything unknown empty: "" for text, null for numbers, [] for lists. When the client\'s words and the agent fields disagree, the client\'s words win.',
  'country: exactly one name from the allowed countries list, or "". A resort or city implies its country (Шарм, Шарм-эль-Шейх, Хургада → Египет; Анталья, Кемер, Аланья, Белек → Турция; Дубай → ОАЭ; Пхукет, Паттайя → Таиланд; Нячанг, Фукуок → Вьетнам; Бали → Индонезия). Uzbek spellings: Misr = Египет, Turkiya = Турция, BAA = ОАЭ, Tailand = Таиланд, Vyetnam = Вьетнам, Gruziya = Грузия, Malayziya = Малайзия.',
  'resort: the resort, city or area the client named, in Russian (Шарм-эль-Шейх for Шарм), else "".',
  'from: the departure city in Russian when stated (Ташкент, Самарканд, Бухара, Фергана, Наманган, Ургенч), else "".',
  'date_from and date_to: the earliest and the latest departure date as YYYY-MM-DD, at most 7 days apart. A date without a year is the next such date on or after today. «НГ», «на Новый год», «Yangi yil» mean departures from 27 to 31 December before the coming New Year. «Навруз» means 18 to 24 March. A month without a day means the first 7 days of that month. One exact date gives date_from = date_to. With nothing about dates both are "".',
  'nights: the number of nights. «неделя» = 7, «10 дней» = 9, «2 недели» = 14. null when not stated.',
  'adults: the number of adults (взр, взрослых, kattalar), null when not stated.',
  'kid_ages: one entry per child, in order: the age in years when stated, 1 for an infant (младенец, грудной), null when the age is not stated. «4 детей» gives [null, null, null, null]. [] when there are no children.',
  'hotels: each hotel or hotel chain the client names, at most 4. asked: the name exactly as the client wrote it. latin: that name in Latin letters as tour operators list it (Риксос → Rixos, Султан → Sultan). candidates: up to 4 full names of hotels that really exist in that resort and fit what the client named, in Latin, most likely first (Султан in Шарм-эль-Шейх → Sultan Gardens Resort); [] when unsure. stars: 1 to 5 when the client gives them for that hotel, else null.',
  'stars: hotel categories the client asks for in general (5* → [5], 4–5 звёзд → [4, 5]), else [].',
  'meals: the meal plans asked for: RO, BB, HB, FB, AI, UAI (всё включено = AI, ультра всё включено = UAI, завтраки = BB, полупансион = HB, полный пансион = FB), else [].',
  'budget: {"amount": number, "currency": "USD" | "EUR" | "UZS", "basis": "person" | "total" | ""} when a budget is named ($ and у.е. = USD, сум = UZS), else null. basis is "person" or "total" only when the client says so (на человека, на всех, за двоих), else "".',
  'note: one short sentence for the agent, in the requested language, only about a wish none of the fields above can hold (sea view, first line, aqua park, quiet hotel, flight time, two rooms). Never restate the country, resort, dates, nights, party, children, meals, stars, budget or hotels. Most requests have no such wish, and then note is "". Examples: «семья с грудным ребёнком» → ""; «5 звёзд в рамках бюджета» → ""; «хотят первую линию» → "Хотят отель на первой линии"; «тихий отель без аниматоров» → "Нужен тихий отель без анимации".',
  'Shape: {"country":"","resort":"","from":"","date_from":"","date_to":"","nights":null,"adults":null,"kid_ages":[],"hotels":[{"asked":"","latin":"","candidates":[],"stars":null}],"stars":[],"meals":[],"budget":null,"note":""}',
].join('\n')

const plain = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''

const whole = (value: unknown, min: number, max: number): number | null => {
  if (value === null || value === undefined || value === '') return null

  const parsed = Math.round(Number(value))

  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null
}

const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

export function requestOf(lead: ILeadRequest): string {
  const lines = [
    lead.destination.trim() && `Направление: ${lead.destination.trim()}`,
    lead.plannedDates.trim() && `Даты: ${lead.plannedDates.trim()}`,
    lead.adults > 0 && `Взрослых: ${lead.adults}`,
    lead.childrenAges.length > 0 && `Дети, возраст: ${lead.childrenAges.join(', ')}`,
    lead.budgetAmount && `Бюджет: ${lead.budgetAmount} ${lead.budgetCurrency || ''}`.trim(),
  ].filter(Boolean)

  return lines.join('\n')
}

export function hasRequest(lead: ILeadRequest): boolean {
  return Boolean(lead.comment.trim() || lead.destination.trim() || lead.plannedDates.trim())
}

export function leadSearchPrompt(input: { lead: ILeadRequest, countries: string[], today: string, locale: string }): string {
  const fields = requestOf(input.lead)

  return [
    `Today: ${input.today}`,
    `Requested language for note: ${LANGUAGES[input.locale] ?? LANGUAGES.ru}`,
    `Allowed countries: ${input.countries.join(', ')}`,
    `Agent fields:\n${fields || '(empty)'}`,
    `Client's words:\n"""\n${input.lead.comment.trim().slice(0, MAX_TEXT) || '(empty)'}\n"""`,
  ].join('\n\n')
}

export function leadSearchFactsOf(raw: unknown, context: { countries: ReferenceItem[], today: string }): ILeadSearchFacts {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const first = plain(input.date_from, 10)
  const dateFrom = ISO_DATE.test(first) && first >= context.today ? first : ''
  const last = plain(input.date_to, 10)
  const latest = dateFrom ? addDays(dateFrom, MAX_RANGE_DAYS) : ''
  const dateTo = !dateFrom ? '' : ISO_DATE.test(last) && last >= dateFrom ? (last > latest ? latest : last) : dateFrom

  const budget = budgetOf(input.budget)
  const note = plain(input.note, 200)

  return {
    country: labelMatch(plain(input.country, 80), context.countries)?.label ?? '',
    resort: plain(input.resort, 60),
    from: plain(input.from, 40),
    dateFrom,
    dateTo,
    nights: whole(input.nights, 1, 30),
    adults: whole(input.adults, 1, 12),
    kidAges: listOf(input.kid_ages).slice(0, 8).map(age => whole(age, 0, 17)),
    hotels: hotelsOf(input.hotels),
    stars: [...new Set(listOf(input.stars).map(star => whole(star, 1, 5)).filter((star): star is number => star !== null))].sort(),
    meals: LEAD_MEALS.filter(meal => listOf(input.meals).map(item => plain(item, 4).toUpperCase()).includes(meal)),
    budget,
    note: budget && note.replace(/\s/g, '').includes(String(budget.amount)) ? '' : note,
  }
}

function hotelsOf(raw: unknown): IAskedHotel[] {
  return listOf(raw).flatMap((item) => {
    const input = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    const hotel: IAskedHotel = {
      asked: plain(input.asked, 80),
      latin: plain(input.latin, 80),
      candidates: listOf(input.candidates).map(name => plain(name, 80)).filter(Boolean).slice(0, MAX_CANDIDATES),
      stars: whole(input.stars, 1, 5),
    }

    return hotel.asked || hotel.latin || hotel.candidates.length ? [hotel] : []
  }).slice(0, MAX_ASKED_HOTELS)
}

function budgetOf(raw: unknown): ILeadBudget | null {
  if (!raw || typeof raw !== 'object') return null

  const input = raw as Record<string, unknown>
  const amount = Number(input.amount)
  const currency = plain(input.currency, 4).toUpperCase()
  const basis = plain(input.basis, 8)

  if (!Number.isFinite(amount) || amount <= 0 || !BUDGET_CURRENCIES.includes(currency as typeof BUDGET_CURRENCIES[number])) return null

  return { amount, currency, basis: basis === 'person' || basis === 'total' ? basis : '' }
}

export function windowOf(facts: ILeadSearchFacts, today: string): { dateFrom: string, dateTo: string, assumed: boolean } {
  if (facts.dateFrom) return { dateFrom: facts.dateFrom, dateTo: facts.dateTo || facts.dateFrom, assumed: false }

  const start = addDays(today, 1)

  return { dateFrom: start, dateTo: addDays(start, MAX_RANGE_DAYS - 1), assumed: true }
}

export function partyOf(facts: ILeadSearchFacts, lead: Pick<ILeadRequest, 'adults' | 'childrenAges'>): { adults: number, kidAges: number[], assumed: boolean, crowded: boolean } {
  const adults = Math.min(MAX_ADULTS, facts.adults ?? (lead.adults > 0 ? lead.adults : DEFAULT_ADULTS))
  const stored = lead.childrenAges.filter(age => Number.isInteger(age) && age >= 0 && age <= 17)
  const asked = facts.kidAges.length ? facts.kidAges : stored
  const filled = asked.map((age, index) => age ?? (stored.length === asked.length ? stored[index] : undefined) ?? null)
  const kidAges = filled.map(age => age ?? DEFAULT_KID_AGE).slice(0, MAX_KIDS)

  return {
    adults,
    kidAges,
    assumed: filled.some(age => age === null),
    crowded: (facts.adults ?? adults) + asked.length > ROOM_PEOPLE,
  }
}
