import { describe, expect, it } from 'vitest'
import { hasRequest, leadSearchFactsOf, leadSearchPrompt, partyOf, requestOf, upcoming, windowOf } from './lead-search'
import type { ILeadRequest, ILeadSearchFacts } from './lead-search'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const countries = [
  { slug: 'egypt', label: 'Египет' },
  { slug: 'turkey', label: 'Турция' },
  { slug: 'china', label: 'Китай' },
  { slug: 'malaysia', label: 'Малайзия' },
].map(item => ({ ...item, code: item.slug }))

const today = '2026-10-26'

const request = (changes: Partial<ILeadRequest> = {}): ILeadRequest => ({
  comment: 'Турпакет на НГ, Шарм, отель Султан/Риксос на 3 взр + 4 детей',
  destination: '',
  plannedDates: '',
  adults: 2,
  childrenAges: [],
  budgetAmount: null,
  budgetCurrency: '',
  ...changes,
})

const facts = (changes: Partial<ILeadSearchFacts> = {}): ILeadSearchFacts => ({
  destinations: [{ country: 'Египет', resort: 'Шарм-эль-Шейх', areas: [], hotels: [], note: '' }],
  from: '', dateFrom: '2026-12-27', dateTo: '2026-12-31', nights: null,
  adults: 3, kidAges: [null, null, null, null], stars: [], meals: [], budget: null, note: '',
  ...changes,
})

describe('lead search facts', () => {
  it('keeps what Gemini read and matches the country', () => {
    const read = leadSearchFactsOf({
      from: '', date_from: '2026-12-27', date_to: '2026-12-31', nights: null,
      adults: 3, kid_ages: [null, null, null, null],
      stars: [5, '5', 9], meals: ['ai', 'XX'], budget: { amount: 5000, currency: 'usd', basis: 'total' }, note: 'Хотят рядом с аквапарком',
      destinations: [{
        country: 'египет', resort: 'Шарм-эль-Шейх', note: '',
        hotels: [{ asked: 'Султан', latin: 'Sultan', candidates: ['Sultan Gardens Resort'], stars: null }, { asked: '', latin: '', candidates: [] }],
      }],
    }, { countries, today })

    expect(read.destinations).toHaveLength(1)
    expect(read.destinations[0]!.country).toBe('Египет')
    expect(read.note).toBe('Хотят рядом с аквапарком')
    expect(read.dateFrom).toBe('2026-12-27')
    expect(read.dateTo).toBe('2026-12-31')
    expect(read.adults).toBe(3)
    expect(read.kidAges).toEqual([null, null, null, null])
    expect(read.destinations[0]!.hotels).toEqual([{ asked: 'Султан', latin: 'Sultan', candidates: ['Sultan Gardens Resort'], stars: null }])
    expect(read.stars).toEqual([5])
    expect(read.meals).toEqual(['AI'])
    expect(read.budget).toEqual({ amount: 5000, currency: 'USD', basis: 'total' })
  })

  it('moves a date Gemini put in this year to next year, and drops older ones', () => {
    const july = leadSearchFactsOf({ date_from: '2026-07-01', date_to: '2026-07-07' }, { countries, today })

    expect([july.dateFrom, july.dateTo]).toEqual(['2027-07-01', '2027-07-07'])
    expect(leadSearchFactsOf({ date_from: '2026-12-28', date_to: '2026-01-02' }, { countries, today }).dateTo).toBe('2027-01-02')
    expect(leadSearchFactsOf({ date_from: '2025-03-01' }, { countries, today }).dateFrom).toBe('')
    expect(upcoming('2024-02-29', '2024-03-01')).toBe('')
  })

  it('caps a window at seven days', () => {
    expect(leadSearchFactsOf({ date_from: '2026-12-20', date_to: '2027-01-10' }, { countries, today }).dateTo).toBe('2026-12-27')
    expect(leadSearchFactsOf({ date_from: '2026-12-20', date_to: 'soon' }, { countries, today }).dateTo).toBe('2026-12-20')
  })

  it('keeps every destination the client weighs, in order', () => {
    const read = leadSearchFactsOf({
      adults: 2,
      destinations: [
        { country: 'Китай', resort: 'Хайнань', hotels: [], note: 'Отель в центре недалеко от моря' },
        { country: 'Малайзия', resort: 'Лангкави + Куала-Лумпур', hotels: [], note: '' },
        { country: 'Китай', resort: 'Хайнань', hotels: [], note: '' },
        { country: '', resort: '', hotels: [], note: '' },
      ],
    }, { countries, today })

    expect(read.destinations.map(place => `${place.country}/${place.resort}`)).toEqual(['Китай/Хайнань', 'Малайзия/Лангкави + Куала-Лумпур'])
    expect(read.destinations[0]!.note).toBe('Отель в центре недалеко от моря')
  })

  it('reads a list of plans as several destinations with shared dates and party', () => {
    const read = leadSearchFactsOf([
      { country: 'Китай', resort: 'Санья', adults: 2, kid_ages: [], date_from: '', note: 'Клиент просит отель в центре недалеко от моря.' },
      { country: 'Малайзия', resort: '', adults: 2, note: 'Комби-тур Лангкави + Куала-Лумпур.' },
    ], { countries, today })

    expect(read.destinations.map(place => place.country)).toEqual(['Китай', 'Малайзия'])
    expect(read.destinations[1]!.note).toBe('Комби-тур Лангкави + Куала-Лумпур.')
    expect(read.adults).toBe(2)
    expect(read.note).toBe('')
  })

  it('reads the old flat shape as one destination', () => {
    const read = leadSearchFactsOf({ country: 'Турция', resort: 'Кемер', note: 'Тихий отель' }, { countries, today })

    expect(read.destinations).toEqual([{ country: 'Турция', resort: 'Кемер', areas: [], hotels: [], note: 'Тихий отель' }])
    expect(read.note).toBe('')
  })

  it('keeps one empty destination when nothing was understood', () => {
    expect(leadSearchFactsOf({ destinations: [] }, { countries, today }).destinations).toEqual([{ country: '', resort: '', areas: [], hotels: [], note: '' }])
  })

  it('keeps the towns Gemini lists inside a resort, without repeats', () => {
    const read = leadSearchFactsOf({ destinations: [{ country: 'Египет', resort: 'Шарм-эль-Шейх', areas: ['Наама Бэй', 'Naama Bay', 'Наама Бэй', '', 42] }] }, { countries, today })

    expect(read.destinations[0]!.areas).toEqual(['Наама Бэй', 'Naama Bay'])
  })

  it('drops a note that only repeats the budget', () => {
    const shape = (note: string) => ({ budget: { amount: 2500, currency: 'USD' }, note, destinations: [{ country: 'Турция', note }] })

    expect(leadSearchFactsOf(shape('Byudjet 2 500$ gacha.'), { countries, today }).note).toBe('')
    expect(leadSearchFactsOf(shape('Byudjet 2 500$ gacha.'), { countries, today }).destinations[0]!.note).toBe('')
    expect(leadSearchFactsOf(shape('Хотят первую линию'), { countries, today }).note).toBe('Хотят первую линию')
  })

  it('treats nulls as unknown, not zero', () => {
    const read = leadSearchFactsOf({ nights: null, adults: '', kid_ages: [null, 4] }, { countries, today })

    expect(read.nights).toBeNull()
    expect(read.adults).toBeNull()
    expect(read.kidAges).toEqual([null, 4])
    expect(read.destinations[0]!.country).toBe('')
  })
})

describe('lead search plan', () => {
  it('searches the next week when no dates were asked', () => {
    expect(windowOf(facts({ dateFrom: '', dateTo: '' }), today)).toEqual({ dateFrom: '2026-10-27', dateTo: '2026-11-02', assumed: true })
    expect(windowOf(facts(), today)).toEqual({ dateFrom: '2026-12-27', dateTo: '2026-12-31', assumed: false })
  })

  it('fills unknown kid ages and flags a party too big for one room', () => {
    expect(partyOf(facts(), request())).toEqual({ adults: 3, kidAges: [7, 7, 7, 7], assumed: true, crowded: true })
  })

  it('takes kid ages from the lead when the counts agree', () => {
    expect(partyOf(facts({ adults: null, kidAges: [null, null] }), request({ adults: 2, childrenAges: [4, 9] })))
      .toEqual({ adults: 2, kidAges: [4, 9], assumed: false, crowded: false })
  })

  it('falls back to the lead party when the words say nothing', () => {
    expect(partyOf(facts({ adults: null, kidAges: [] }), request({ adults: 0, childrenAges: [5] })))
      .toEqual({ adults: 2, kidAges: [5], assumed: false, crowded: false })
  })
})

describe('lead request', () => {
  it('needs words, a destination or dates', () => {
    expect(hasRequest(request())).toBe(true)
    expect(hasRequest(request({ comment: ' ' }))).toBe(false)
    expect(hasRequest(request({ comment: '', plannedDates: 'конец декабря' }))).toBe(true)
  })

  it('passes the agent fields and the words to the prompt', () => {
    const lead = request({ destination: 'Египет', budgetAmount: 4000, budgetCurrency: 'USD', childrenAges: [3] })

    expect(requestOf(lead)).toContain('Бюджет: 4000 USD')
    expect(leadSearchPrompt({ lead, countries: ['Египет'], today, locale: 'uz' })).toContain('Uzbek (Latin script)')
    expect(leadSearchPrompt({ lead, countries: ['Египет'], today, locale: 'ru' })).toContain('Шарм, отель Султан/Риксос')
  })
})
