import { describe, expect, it } from 'vitest'
import { hasRequest, leadSearchFactsOf, leadSearchPrompt, partyOf, requestOf, windowOf } from './lead-search'
import type { ILeadRequest, ILeadSearchFacts } from './lead-search'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const countries = [
  { slug: 'egypt', label: 'Египет' },
  { slug: 'turkey', label: 'Турция' },
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
  country: 'Египет', resort: 'Шарм-эль-Шейх', from: '', dateFrom: '2026-12-27', dateTo: '2026-12-31', nights: null,
  adults: 3, kidAges: [null, null, null, null], hotels: [], stars: [], meals: [], budget: null, note: '',
  ...changes,
})

describe('lead search facts', () => {
  it('keeps what Gemini read and matches the country', () => {
    const read = leadSearchFactsOf({
      country: 'египет', resort: 'Шарм-эль-Шейх', from: '', date_from: '2026-12-27', date_to: '2026-12-31', nights: null,
      adults: 3, kid_ages: [null, null, null, null],
      hotels: [{ asked: 'Султан', latin: 'Sultan', candidates: ['Sultan Gardens Resort'], stars: null }, { asked: '', latin: '', candidates: [] }],
      stars: [5, '5', 9], meals: ['ai', 'XX'], budget: { amount: 5000, currency: 'usd', basis: 'total' }, note: 'Хотят рядом с аквапарком',
    }, { countries, today })

    expect(read.country).toBe('Египет')
    expect(read.dateFrom).toBe('2026-12-27')
    expect(read.dateTo).toBe('2026-12-31')
    expect(read.adults).toBe(3)
    expect(read.kidAges).toEqual([null, null, null, null])
    expect(read.hotels).toEqual([{ asked: 'Султан', latin: 'Sultan', candidates: ['Sultan Gardens Resort'], stars: null }])
    expect(read.stars).toEqual([5])
    expect(read.meals).toEqual(['AI'])
    expect(read.budget).toEqual({ amount: 5000, currency: 'USD', basis: 'total' })
  })

  it('drops past dates and caps a window at seven days', () => {
    expect(leadSearchFactsOf({ date_from: '2026-10-01', date_to: '2026-10-05' }, { countries, today }).dateFrom).toBe('')
    expect(leadSearchFactsOf({ date_from: '2026-12-20', date_to: '2027-01-10' }, { countries, today }).dateTo).toBe('2026-12-27')
    expect(leadSearchFactsOf({ date_from: '2026-12-20', date_to: 'soon' }, { countries, today }).dateTo).toBe('2026-12-20')
  })

  it('drops a note that only repeats the budget', () => {
    expect(leadSearchFactsOf({ budget: { amount: 2500, currency: 'USD' }, note: 'Byudjet 2 500$ gacha.' }, { countries, today }).note).toBe('')
    expect(leadSearchFactsOf({ budget: { amount: 2500, currency: 'USD' }, note: 'Хотят первую линию' }, { countries, today }).note).toBe('Хотят первую линию')
  })

  it('treats nulls as unknown, not zero', () => {
    const read = leadSearchFactsOf({ nights: null, adults: '', kid_ages: [null, 4] }, { countries, today })

    expect(read.nights).toBeNull()
    expect(read.adults).toBeNull()
    expect(read.kidAges).toEqual([null, 4])
    expect(read.country).toBe('')
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
