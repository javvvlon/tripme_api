import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { SearchService } from '~/modules/search/search.service'
import type { IHotelSuggestion } from '~/modules/search/search.service'
import { tashkentToday } from '~/modules/search/hot'
import { RouteLookupService } from '~/modules/references/route-lookup.service'
import { labelMatch } from '~/modules/marketing/intake/post'
import type { ReferenceItem } from '~/modules/suppliers/dictionary/dictionary.contracts'
import { GeminiClient } from '~/shared/ai/gemini.client'
import { LeadsService } from '../leads.service'
import type { ILeadPayload } from '../leads.service'
import type { IViewer } from '../lead.access'
import { hasRequest, LEAD_SEARCH_RULES, leadSearchFactsOf, leadSearchPrompt, MAX_PLAN_HOTELS, partyOf, windowOf } from './lead-search'
import type { IAskedHotel, ILeadRequest, ILeadSearchPlan, IPlanHotel } from './lead-search'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const HOME = 'tashkent'

const SUGGESTIONS = 6

const CHAIN_PICKS = 3

@Injectable()
export class LeadSearchService {
  constructor(
    private readonly gemini: GeminiClient,
    private readonly leads: LeadsService,
    private readonly search: SearchService,
    private readonly routes: RouteLookupService,
  ) {}

  async plan(id: string, viewer: IViewer, locale = 'ru'): Promise<ILeadSearchPlan> {
    if (!this.gemini.configured) throw new ServiceUnavailableException('GEMINI_API_KEY is not set')

    const lead = await this.leads.one(id, viewer)
    const request = requestOfLead(lead)

    if (!hasRequest(request)) throw new BadRequestException('The lead has no request to read')

    const today = tashkentToday()
    const departures = (await this.routes.departures()).items
    const start = departures.find(item => item.slug === lead.route_from) ?? departures.find(item => item.slug === HOME) ?? departures[0] ?? null
    const countries = start ? (await this.routes.countriesFrom(start.slug)).items : []

    const raw = await this.gemini.json<unknown>(LEAD_SEARCH_RULES, leadSearchPrompt({
      lead: request,
      countries: countries.map(item => item.label),
      today,
      locale,
    }), { temperature: 0 })

    const facts = leadSearchFactsOf(raw, { countries, today })
    const from = labelMatch(facts.from, departures) ?? start
    const to = from ? await this.destinationOf(facts.country, from, start, countries, lead.route_to) : null
    const window = windowOf(facts, today)
    const party = partyOf(facts, request)
    const matched = from && to ? await this.hotelsOf(facts.hotels, from.slug, to.slug) : { hotels: [], missing: facts.hotels.map(hotel => hotel.asked || hotel.latin) }

    return {
      from: from ? { slug: from.slug, label: from.label } : null,
      to: to ? { slug: to.slug, label: to.label } : null,
      country: facts.country,
      resort: facts.resort,
      date_from: window.dateFrom,
      date_to: window.dateTo,
      dates_assumed: window.assumed,
      nights: facts.nights,
      adults: party.adults,
      kid_ages: party.kidAges,
      ages_assumed: party.assumed,
      crowded: party.crowded,
      hotels: matched.hotels,
      missing_hotels: matched.missing,
      stars: facts.stars,
      meals: facts.meals,
      budget: facts.budget,
      note: facts.note,
    }
  }

  private async destinationOf(country: string, from: ReferenceItem, start: ReferenceItem | null, countries: ReferenceItem[], stored: string): Promise<ReferenceItem | null> {
    const list = from.slug === start?.slug ? countries : (await this.routes.countriesFrom(from.slug)).items

    return labelMatch(country, list) ?? list.find(item => item.slug === stored) ?? null
  }

  private async hotelsOf(asked: IAskedHotel[], from: string, to: string): Promise<{ hotels: IPlanHotel[], missing: string[] }> {
    const found = new Map<string, IPlanHotel>()
    const missing: string[] = []

    for (const hotel of asked) {
      const exact = await Promise.all(hotel.candidates.map(name => this.bestOf(from, to, name, hotel.stars)))
      const picks = exact.filter((pick): pick is IHotelSuggestion => Boolean(pick))
      const chosen = picks.length ? picks : await this.chainOf(from, to, hotel)

      if (!chosen.length) missing.push(hotel.asked || hotel.latin)

      for (const pick of chosen) {
        if (!found.has(pick.key)) found.set(pick.key, { key: pick.key, name: pick.name, stars: pick.stars })
      }
    }

    return { hotels: [...found.values()].slice(0, MAX_PLAN_HOTELS), missing }
  }

  private async bestOf(from: string, to: string, name: string, stars: number | null): Promise<IHotelSuggestion | null> {
    const words = name.split(/\s+/).filter(Boolean)

    for (let size = words.length; size >= Math.min(2, words.length); size--) {
      const suggestions = await this.suggest(from, to, words.slice(0, size).join(' '))
      const best = suggestions.find(item => stars && item.stars === stars) ?? suggestions[0]

      if (best) return best
    }

    return null
  }

  private async chainOf(from: string, to: string, hotel: IAskedHotel): Promise<IHotelSuggestion[]> {
    const query = hotel.latin || hotel.asked

    if (!query) return []

    const suggestions = await this.suggest(from, to, query)

    return suggestions.filter(item => !hotel.stars || !item.stars || item.stars === hotel.stars).slice(0, CHAIN_PICKS)
  }

  private suggest(from: string, to: string, query: string): Promise<IHotelSuggestion[]> {
    return this.search.hotels(from, to, query, SUGGESTIONS).catch(() => [])
  }
}

function requestOfLead(lead: ILeadPayload): ILeadRequest {
  return {
    comment: lead.comment ?? '',
    destination: lead.destination ?? '',
    plannedDates: lead.planned_dates ?? '',
    adults: lead.adults ?? 0,
    childrenAges: Array.isArray(lead.children_ages) ? lead.children_ages : [],
    budgetAmount: lead.budget_amount,
    budgetCurrency: lead.budget_currency ?? '',
  }
}
