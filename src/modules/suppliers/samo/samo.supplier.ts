import { BaseSupplier } from '~/modules/suppliers/base/supplier'
import { RoutesService } from '~/modules/suppliers/dictionary/routes.service'
import { Unsupported, isUnsupported } from '~/modules/suppliers/base/contracts'
import { SamoSearchIntention } from './samo.intention'
import { parseSamoRows } from './samo.parser'
import { mapSamoRow } from './samo.map'
import { CURRENCY_CODES } from '~/modules/suppliers/dictionary/dictionary.seed'
import { SupplierDictionary } from '~/modules/suppliers/dictionary/supplier-dictionary'
import type { ISupplierTransport, SupplierCapabilities } from '~/modules/suppliers/base/contracts'
import type { SearchCriteria } from '~/modules/search/contracts/search'
import { Offer } from '~/modules/search/models/Offer'
import type { SamoQuery, SamoRow } from './samo.contracts'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const SAMO_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

export const SAMO_CAPABILITIES: SupplierCapabilities = {
    nativeFilters: ['hotels', 'priceMin', 'priceMax'],
    pageSize: 100,
    maxPages: 20,
    priceCursor: false,
    maxAdults: 4,
    maxChildren: 3,
  currencies: ['USD', 'EUR', 'UZS'],
}

export abstract class SamoSupplier extends BaseSupplier<SamoQuery, SamoRow> {
  protected abstract readonly baseUrl: string
  protected abstract readonly constants: Record<string, string>

  readonly capabilities: SupplierCapabilities = SAMO_CAPABILITIES

  private cachedDictionary: SupplierDictionary | null = null

  protected get dictionary(): SupplierDictionary {
    return (this.cachedDictionary ??= new SupplierDictionary(
      this.ref.id,
      () => this.transport.fetch(this.baseUrl, { headers: this.pageHeaders }),
      this.seedPath,
    ))
  }

  constructor(
    transport: ISupplierTransport,
    protected readonly routes: RoutesService,
    private readonly seedPath?: string,
  ) {
    super(transport)
  }

  async departures() {
    return this.dictionary.departures()
  }

  routeConstraints() {
    return this.dictionary.routeConstraints()
  }

  async destinationsFrom(departureSlug: string) {
    const departureCode = await this.dictionary.departureCode(departureSlug)

    if (!departureCode) return []

    const items = await this.routes.forDeparture(
      this.ref.id,
      departureCode,
      this.baseUrl,
      (url: string) => this.transport.fetch(url, { headers: this.pageHeaders }),
    )

    this.dictionary.rememberCountries(items)

    return items
  }

  protected async buildQuery(criteria: SearchCriteria, page: number): Promise<SamoQuery | Unsupported> {
    if (criteria.adults > this.capabilities.maxAdults) {
      return new Unsupported(`at most ${this.capabilities.maxAdults} adults`)
    }

    const townFrom = await this.dictionary.departureCode(criteria.from)
    if (!townFrom) return new Unsupported(`does not fly from "${criteria.from}"`)

    await this.destinationsFrom(criteria.from)

    const state = await this.dictionary.countryCode(criteria.to)
    if (!state) return new Unsupported(`does not sell "${criteria.to}" from "${criteria.from}"`)

    const params = new SamoSearchIntention({ townFrom, state }, page, this.constants).toRequest(criteria)

    if (isUnsupported(params)) return params

    return { params, baseUrl: this.baseUrl }
  }

  protected override get requestHeaders(): Record<string, string> {
    return {
      'User-Agent': SAMO_USER_AGENT,
      'Accept': '*/*',
      'Accept-Language': 'ru-RU,ru;q=0.9',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': this.baseUrl,
    }
  }

  async routeFacts(departureSlug: string, countrySlug: string) {
    const departureCode = await this.dictionary.departureCode(departureSlug)
    if (!departureCode) return null

    await this.destinationsFrom(departureSlug)

    const countryCode = await this.dictionary.countryCode(countrySlug)
    if (!countryCode) return null

    return this.routes.calendarFor(
      this.ref.id,
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
    const offer = mapSamoRow(row, criteria, this.ref, this.baseUrl)

    return offer ? this.withConvertedPrice(offer, criteria) : null
  }

  private withConvertedPrice(offer: Offer, criteria: SearchCriteria): Offer {
    const price = offer.get('price')
    const target = criteria.currency

    if (price.source.currency === target) return offer

    const from = CURRENCY_CODES[price.source.currency]
    const to = CURRENCY_CODES[target]
    const rate = from && to ? this.dictionary.rate(from, to) : null

    if (!rate) return offer

    return new Offer({
      ...offer.toObject(),
      price: {
        ...price,
        converted: {
          amount: Math.round(price.source.amount * rate * 100) / 100,
          currency: target,
        },
      },
    })
  }
}
