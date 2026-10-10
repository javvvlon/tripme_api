import { BaseSupplier } from '~/modules/suppliers/base/supplier'
import { RoutesService } from '~/modules/suppliers/dictionary/routes.service'
import { Unsupported, isUnsupported } from '~/modules/suppliers/base/contracts'
import { SamoSearchIntention } from './samo.intention'
import { parseSamoRows } from './samo.parser'
import { mapSamoRow } from './samo.map'
import { parseHotelCatalog } from './samo.catalog'
import type { ISamoHotelPlace } from './samo.catalog'
import { CURRENCY_CODES } from '~/modules/suppliers/dictionary/dictionary.seed'
import { SupplierDictionary } from '~/modules/suppliers/dictionary/supplier-dictionary'
import type { ISupplierTransport, SupplierCapabilities } from '~/modules/suppliers/base/contracts'
import type { SearchCriteria } from '~/modules/search/contracts/search'
import { Offer } from '~/modules/search/models/Offer'
import type { SamoQuery, SamoRow } from './samo.contracts'
import { hotelKey } from '~/modules/search/hotel-key'
import type { ISupplierHotel } from '~/modules/suppliers/base/contracts'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const SAMO_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

const CATALOG_TTL_MS = 12 * 60 * 60 * 1000
const CATALOG_RETRY_MS = 10 * 60 * 1000

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

  private readonly catalogs = new Map<string, { at: number, ttl: number, hotels: Promise<Map<string, ISamoHotelPlace>> }>()

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
    const townFrom = await this.dictionary.departureCode(criteria.from)
    if (!townFrom) return new Unsupported(`does not fly from "${criteria.from}"`)

    const limits = this.dictionary.routeConstraints()
    const maxAdults = limits.maxAdults > 1 ? limits.maxAdults : this.capabilities.maxAdults
    const maxChildren = limits.maxChildren > 0 ? limits.maxChildren : this.capabilities.maxChildren

    if (criteria.adults > maxAdults) return new Unsupported(`at most ${maxAdults} adults`)
    if (criteria.childrenAges.length > maxChildren) return new Unsupported(`at most ${maxChildren} children`)

    await this.destinationsFrom(criteria.from)

    const state = await this.dictionary.countryCode(criteria.to)
    if (!state) return new Unsupported(`does not sell "${criteria.to}" from "${criteria.from}"`)

    if (criteria.filters.hotels.length) {
      const wanted = new Set(criteria.filters.hotels)
      const catalog = await this.hotelCatalog(townFrom, state, this.constants.STATEFROM ?? '')
      const codes = [...catalog].filter(([, hotel]) => hotel.name && wanted.has(hotelKey(hotel.name))).map(([code]) => code)

      if (!codes.length) return new Unsupported('does not sell the chosen hotels')

      criteria = { ...criteria, filters: { ...criteria.filters, hotels: codes } }
    }

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

  async hotels(departureSlug: string, countrySlug: string): Promise<ISupplierHotel[]> {
    const townFrom = await this.dictionary.departureCode(departureSlug)
    if (!townFrom) return []

    await this.destinationsFrom(departureSlug)

    const state = await this.dictionary.countryCode(countrySlug)
    if (!state) return []

    const catalog = await this.hotelCatalog(townFrom, state, this.constants.STATEFROM ?? '')

    return [...catalog].filter(([, hotel]) => hotel.name).map(([code, hotel]) => ({ code, name: hotel.name, stars: hotel.starCount }))
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

  protected override async prepare(rows: SamoRow[]): Promise<void> {
    const first = rows[0]
    if (!first?.townfrom || !first.state) return

    const catalog = await this.hotelCatalog(first.townfrom, first.state, first.statefrom)

    for (const row of rows) {
      const place = catalog.get(row.hotel)

      row.townKey = place?.town ?? ''
      row.starKey = place?.stars ?? ''
    }
  }

  private hotelCatalog(townFrom: string, state: string, stateFrom: string): Promise<Map<string, ISamoHotelPlace>> {
    const key = `${townFrom}:${state}:${stateFrom}`
    const cached = this.catalogs.get(key)

    if (cached && Date.now() - cached.at < cached.ttl) return cached.hotels

    const params = new URLSearchParams({ TOWNFROMINC: townFrom, STATEINC: state })
    if (stateFrom) params.set('STATEFROM', stateFrom)

    const entry = { at: Date.now(), ttl: CATALOG_TTL_MS, hotels: Promise.resolve(new Map<string, ISamoHotelPlace>()) }

    entry.hotels = this.transport.fetch(`${this.baseUrl}?${params.toString()}`, { headers: this.pageHeaders })
      .then(parseHotelCatalog)
      .then((catalog) => {
        if (!catalog.size) entry.ttl = CATALOG_RETRY_MS

        return catalog
      })
      .catch((error: unknown) => {
        this.logger.warn(`hotel catalog for ${key} unavailable: ${String(error)}`)
        entry.ttl = CATALOG_RETRY_MS

        return new Map<string, ISamoHotelPlace>()
      })

    this.catalogs.set(key, entry)

    return entry.hotels
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
