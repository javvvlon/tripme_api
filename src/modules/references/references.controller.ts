import { Controller, Get, Query } from '@nestjs/common'
import { DictionaryService } from '~/modules/suppliers/dictionary/dictionary.service'
import { CalendarService } from './calendar.service'
import { RouteLookupService } from './route-lookup.service'

/**
 * Everything the search form needs before a search exists.
 *
 * Split by cost, not by tidiness:
 *
 *  - `/departures` and `/countries` are small and stable, so the client may
 *    load them once and render the form server-side;
 *  - `/constraints` depends on the chosen route and cannot be cached globally —
 *    the same supplier offers nights 2–14 out of Tashkent and 4–15 (no 9) out
 *    of Vienna, with different adult limits;
 *  - hotels are deliberately absent. There are over a thousand for one country;
 *    that is a typeahead, never a payload.
 *
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('references')
export class ReferencesController {
  constructor(
    private readonly dictionary: DictionaryService,
    private readonly calendar: CalendarService,
    private readonly routes: RouteLookupService,
  ) {}

  @Get('departures')
  departures() {
    return { items: this.dictionary.departures() }
  }

  /**
   * Destinations reachable from a departure — read from the operator itself,
   * because the cascade is severe: 27 out of Tashkent, 4 out of Samarkand,
   * exactly 1 out of Bukhara. Offering the union would mean offering searches
   * that cannot return anything.
   */
  @Get('countries')
  async countries(@Query('from') from?: string) {
    return this.routes.countriesFrom(from)
  }

  /**
   * Everything that constrains the form once both ends of the route are known:
   * which nights are sellable, how many travellers fit, and which dates the
   * supplier will even accept.
   */
  /**
   * Everything that constrains the form once the route is known — read from
   * the supplier, not assumed. Nights are a discrete list and differ by route
   * (2–14 out of Tashkent, 4–15 without 9 out of Vienna), as do the party
   * limits and the sellable dates.
   *
   * Falls back to the harvested dump when nobody publishes facts for a route,
   * so the form is never left without options.
   */
  @Get('constraints')
  async constraints(@Query('from') from?: string, @Query('to') to?: string) {
    const fallback = this.dictionary.routeConstraints(from, to)
    const facts = await this.calendar.factsFor(from, to)

    return {
      nights: facts?.nights.length ? facts.nights : fallback.nights,
      maxAdults: facts?.maxAdults ?? fallback.maxAdults,
      maxChildren: facts?.maxChildren ?? fallback.maxChildren,
      currencies: ['USD', 'EUR', 'UZS'],
      calendar: await this.calendar.forRoute(from, to),
    }
  }
}
