import { BaseSupplier } from '~/modules/suppliers/base/supplier'
import { RoutesService } from '~/modules/suppliers/dictionary/routes.service'
import { Unsupported, isUnsupported } from '~/modules/suppliers/base/contracts'
import { SamoSearchIntention } from './samo.intention'
import { parseSamoRows } from './samo.parser'
import { mapSamoRow } from './samo.map'
import { DictionaryService } from '~/modules/suppliers/dictionary/dictionary.service'
import type { ISupplierTransport, SupplierCapabilities } from '~/modules/suppliers/base/contracts'
import type { SearchCriteria } from '~/modules/search/contracts/search'
import type { Offer } from '~/modules/search/models/Offer'
import type { SamoQuery, SamoRow } from './samo.contracts'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
/**
 * A plain fetch with no User-Agent reads as a bot to most stacks and gets a
 * different response than the browser does. Identifying as a normal browser is
 * about getting the same page a person would, not about hiding.
 */
const SAMO_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

export abstract class SamoSupplier extends BaseSupplier<SamoQuery, SamoRow> {
  protected abstract readonly baseUrl: string
  protected abstract readonly constants: Record<string, string>

  readonly capabilities: SupplierCapabilities = {
    /**
     * Only what we can express in SAMO's own vocabulary.
     *
     * Established by trying each one against the live endpoint rather than by
     * reading the markup, because the two disagree:
     *
     *   COSTMIN / COSTMAX  honoured  (priceMin=1300 → cheapest 1303)
     *   HOTELS             honoured  (a data-hotel code → that one hotel)
     *   MEALS              ignored   (meals=4 → 0 rows, though 4=BB on 99 of them)
     *   STARS              ignored   (stars=5 → 0 rows, though 5 exist)
     *
     * So `data-meal` in the response is NOT the code space `MEALS` expects,
     * even though both are small integers — the resemblance is a trap. Sending
     * an untranslated value returns an empty page, which an agent reads as
     * "no availability" rather than "wrong parameter".
     *
     * Anything absent here is applied to the fetched page instead, and the
     * response reports it, because narrowing the cheapest hundred rows is not
     * the same as searching the market.
     */
    nativeFilters: ['hotels', 'priceMin', 'priceMax'],
    pageSize: 100,
    maxPages: 20,
    priceCursor: false,
    maxAdults: 4,
    maxChildren: 3,
    currencies: ['USD', 'EUR', 'UZS'],
  }

  constructor(
    transport: ISupplierTransport,
    protected readonly dictionary: DictionaryService,
    protected readonly routes: RoutesService,
  ) {
    super(transport)
  }

  /**
   * Their search page renders the destination list for whichever departure is
   * in the query string, so one page load answers this exactly — no guessing,
   * and no serving one city's list for another's.
   */
  async destinationsFrom(departureCode: string) {
    return this.routes.forDeparture(
      departureCode,
      this.baseUrl,
      (url: string) => this.transport.fetch(url, { headers: this.pageHeaders }),
    )
  }

  protected buildQuery(criteria: SearchCriteria, page: number): SamoQuery | Unsupported {
    if (criteria.adults > this.capabilities.maxAdults) {
      return new Unsupported(`at most ${this.capabilities.maxAdults} adults`)
    }

    const params = new SamoSearchIntention(this.dictionary, page, this.constants).toRequest(criteria)

    if (isUnsupported(params)) return params

    return { params, baseUrl: this.baseUrl }
  }

  /**
   * Verified against the live endpoint on 2026-08-23: it answers 200 with a
   * full page of results **without** CATCLAIM and **without** rev. So the
   * adapter is stateless — no session to acquire, cache or refresh, and no
   * coupling to their frontend's build number. If that ever changes, the
   * symptom is an empty body, which the transport already turns into an error
   * rather than a silent zero-result search.
   */
  protected override get requestHeaders(): Record<string, string> {
    return {
      'User-Agent': SAMO_USER_AGENT,
      'Accept': '*/*',
      'Accept-Language': 'ru-RU,ru;q=0.9',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': this.baseUrl,
    }
  }

  /**
   * Headers for loading their search *page*, as opposed to calling the search
   * endpoint.
   *
   * Same URL, two behaviours: with `X-Requested-With: XMLHttpRequest` the
   * server answers with the AJAX payload, without it with the full HTML page.
   * Reusing the search headers here returned a body with no <select> in it and
   * parsed to zero destinations — a silent empty list, not an error.
   */
  /** The published check-in days for a route — see RoutesService.calendarFor. */
  async calendarFor(departureCode: string, countryCode: string) {
    return this.routes.calendarFor(
      departureCode,
      countryCode,
      this.baseUrl,
      (url: string) => this.transport.fetch(url, { headers: this.pageHeaders }),
    )
  }

  protected get pageHeaders(): Record<string, string> {
    return {
      'User-Agent': SAMO_USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'ru-RU,ru;q=0.9',
    }
  }

  protected buildUrl(query: SamoQuery): string {
    const qs = new URLSearchParams(query.params).toString()
    return `${query.baseUrl}?${qs}`
  }

  protected parse(payload: string): SamoRow[] {
    return parseSamoRows(payload)
  }

  protected map(row: SamoRow, criteria: SearchCriteria): Offer | null {
    return mapSamoRow(row, criteria, this.ref, this.baseUrl)
  }
}
