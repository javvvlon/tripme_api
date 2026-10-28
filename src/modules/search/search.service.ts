import { Inject, Injectable, Logger } from '@nestjs/common'
import { isUnsupported } from '~/modules/suppliers/base/contracts'
import { SUPPLIERS } from '~/modules/suppliers/base/tokens'
import { OperatorsService } from '~/modules/operators/operators.service'
import { SupplierState } from './contracts/search'
import type { ISupplier, ISupplierTown } from '~/modules/suppliers/base/contracts'
import { Observable } from 'rxjs'
import { buildFacets } from './facets'
import { Offer } from './models/Offer'
import type { IOffer } from './models/Offer'
import { CacheService } from '~/shared/cache/cache.service'
import { RatesService } from '~/modules/references/rates.service'
import { uzsByCbu } from './uzs'
import { SEARCH_CACHE_TTL_MS, SEARCH_FAILURE_TTL_MS, failureKey, searchCacheKey } from './search.cache'
import type { SearchFacets } from './facets'
import type { SearchCriteria, SupplierStatus } from './contracts/search'
import { activeLocalFacets, localFilter } from './local-filters'
import { cheapestOnSale } from './sale'
import { hotelKey, hotelLabel, matchesHotel } from './hotel-key'
import { resortTowns } from './areas'
import { withKnownStars } from './stars'

export interface IHotelSuggestion {
  key: string
  name: string
  stars: number | null
  suppliers: number
}

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface SearchPage {
  offers: Offer[]
  statuses: SupplierStatus[]
  page: number
  hasMore: boolean
  appliedLocally: string[]
}

interface SupplierRun {
  status: SupplierStatus
  offers: Offer[]
  hasMore: boolean
}

export type SearchStreamEvent =
  | { type: 'start', statuses: SupplierStatus[] }
  | { type: 'offers', statuses: SupplierStatus[], items: unknown[], facets: SearchFacets }
  | { type: 'done', statuses: SupplierStatus[], hasMore: boolean, appliedLocally: string[], total: number }

export interface SoonestDeparture {
  date: string | null
  span: number
  statuses: SupplierStatus[]
}

const SOONEST_WINDOWS = [7, 21, 60] as const

const addDays = (day: string, count: number): string => {
  const date = new Date(`${day}T00:00:00Z`)

  date.setUTCDate(date.getUTCDate() + count)

  return date.toISOString().slice(0, 10)
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name)

  constructor(
    @Inject(SUPPLIERS) private readonly suppliers: ISupplier[],
    private readonly operators: OperatorsService,
    private readonly cache: CacheService,
    private readonly rates: RatesService,
  ) {}

  private async withCbuUzs(offers: Offer[]): Promise<Offer[]> {
    if (offers.every(offer => offer.get('price').uzs)) return offers

    const cbu = await this.rates.display().catch(() => null)

    return offers.map((offer) => {
      const price = offer.get('price')

      if (price.uzs || price.source.currency === 'UZS') return offer

      const uzs = uzsByCbu(price.source.amount, cbu?.rates[price.source.currency], cbu?.source === 'market' ? 'market' : 'cbu')

      return uzs ? new Offer({ ...offer.payload(), price: { ...price, uzs } }) : offer
    })
  }

  private async live(): Promise<ISupplier[]> {
    const enabled = new Set(await this.operators.enabledSlugs())

    return this.suppliers.filter(supplier => enabled.has(supplier.ref.id))
  }

  private async suppliersFor(criteria: SearchCriteria): Promise<ISupplier[]> {
    const live = await this.live()

    return criteria.filters.suppliers?.length
      ? live.filter(s => criteria.filters.suppliers.includes(s.ref.id))
      : live
  }

  private async runSupplier(
    supplier: ISupplier,
    criteria: SearchCriteria,
    page: number,
    signal?: AbortSignal,
  ): Promise<SupplierRun> {
    const started = Date.now()
    const key = searchCacheKey(supplier.ref.id, criteria, page)
    const stored = await this.cache.getJson<{ offers: IOffer[], hasMore: boolean }>(key)

    if (stored) {
      const offers = await this.withCbuUzs(stored.offers.map(offer => new Offer(offer)))

      return {
        offers,
        hasMore: stored.hasMore,
        status: {
          supplier: supplier.ref,
          state: SupplierState.Done,
          offers: offers.length,
          tookMs: Date.now() - started,
          cached: true,
        },
      }
    }

    const failed = await this.cache.getText(failureKey(key))

    if (failed) {
      return {
        offers: [],
        hasMore: false,
        status: {
          supplier: supplier.ref,
          state: SupplierState.Failed,
          offers: 0,
          reason: failed,
          tookMs: Date.now() - started,
          cached: true,
        },
      }
    }

    try {
      const result = await supplier.fetchPage(criteria, page, signal)
      const offers = cheapestOnSale(result.offers)

      if (!signal?.aborted) {
        const raw = offers.map(offer => offer.payload())

        void this.cache.setJson(key, { offers: raw, hasMore: result.hasMore }, SEARCH_CACHE_TTL_MS)
      }

      return {
        offers: await this.withCbuUzs(offers),
        hasMore: result.hasMore,
        status: {
          supplier: supplier.ref,
          state: SupplierState.Done,
          offers: offers.length,
          tookMs: Date.now() - started,
        },
      }
    }
    catch (error) {
      const unsupported = isUnsupported(error)

      if (!unsupported && !signal?.aborted) {
        this.logger.error(`${supplier.ref.id} failed: ${String(error)}`)

        const reason = error instanceof Error ? error.message : 'unknown error'

        void this.cache.setText(failureKey(key), reason, SEARCH_FAILURE_TTL_MS)
      }

      return {
        offers: [],
        hasMore: false,
        status: {
          supplier: supplier.ref,
          state: unsupported ? SupplierState.Unsupported : SupplierState.Failed,
          offers: 0,
          reason: unsupported
            ? error.reason
            : error instanceof Error ? error.message : 'unknown error',
          tookMs: Date.now() - started,
        },
      }
    }
  }

  async fetchPage(asked: SearchCriteria, page: number, signal?: AbortSignal): Promise<SearchPage> {
    const criteria = await this.withAreas(asked)
    const suppliers = await this.suppliersFor(criteria)

    const results = await Promise.all(
      suppliers.map(supplier => this.runSupplier(supplier, criteria, page, signal)),
    )

    const merged = withKnownStars(results.flatMap(r => r.offers))
      .sort((a, b) => a.comparePrice() - b.comparePrice())

    const { offers, appliedLocally } = this.applyLocalFilters(merged, criteria)

    return {
      offers,
      statuses: results.map(r => r.status),
      page,
      hasMore: results.some(r => r.hasMore),
      appliedLocally,
    }
  }

  stream(asked: SearchCriteria): Observable<SearchStreamEvent> {
    return new Observable<SearchStreamEvent>((subscriber) => {
      const abort = new AbortController()

      void (async () => {
        const criteria = await this.withAreas(asked)
        const suppliers = await this.suppliersFor(criteria)

        const statuses = new Map<string, SupplierStatus>(suppliers.map(supplier => [
          supplier.ref.id,
          { supplier: supplier.ref, state: SupplierState.Searching, offers: 0 },
        ]))

        const snapshot = () => [...statuses.values()]

        subscriber.next({ type: 'start', statuses: snapshot() })

        let all: Offer[] = []
        let raw: Offer[] = []
        const known = new Map<string, number>()
        let hasMore = false
        let appliedLocally: string[] = []

        await Promise.all(suppliers.map(async (supplier) => {
          const run = await this.runSupplier(supplier, criteria, 1, abort.signal)

          if (abort.signal.aborted) return

          const offers = withKnownStars(run.offers, known)
          const local = this.applyLocalFilters(offers, criteria)

          appliedLocally = local.appliedLocally
          raw = [...raw, ...offers]
          hasMore = hasMore || run.hasMore
          all = [...all, ...local.offers].sort((a, b) => a.comparePrice() - b.comparePrice())
          statuses.set(supplier.ref.id, { ...run.status, offers: local.offers.length })

          subscriber.next({
            type: 'offers',
            statuses: snapshot(),
            items: local.offers.map(offer => offer.toObject()),
            facets: this.facetsOf(all, raw, criteria),
          })
        }))

        if (abort.signal.aborted) return

        subscriber.next({ type: 'done', statuses: snapshot(), hasMore, appliedLocally, total: all.length })
        subscriber.complete()
      })().catch(error => subscriber.error(error))

      return () => abort.abort()
    })
  }

  async soonest(criteria: SearchCriteria, signal?: AbortSignal): Promise<SoonestDeparture> {
    let statuses: SupplierStatus[] = []

    for (const span of SOONEST_WINDOWS) {
      const page = await this.fetchPage(
        { ...criteria, dateTo: addDays(criteria.dateFrom, span - 1) },
        1,
        signal,
      )

      statuses = page.statuses

      const earliest = page.offers
        .map(offer => offer.get('checkIn'))
        .filter(Boolean)
        .sort()[0]

      if (earliest) return { date: earliest, span, statuses }
    }

    return { date: null, span: SOONEST_WINDOWS.at(-1)!, statuses }
  }

  async hotels(from: string, to: string, query: string, limit = 20): Promise<IHotelSuggestion[]> {
    if (!query.trim()) {
      for (const supplier of this.suppliers) void supplier.hotels?.(from, to).catch(() => [])

      return []
    }

    const lists = await Promise.allSettled(this.suppliers.map(async supplier => ({
      supplier: supplier.ref.id,
      hotels: await supplier.hotels?.(from, to) ?? [],
    })))
    const found = new Map<string, IHotelSuggestion & { names: Map<string, number> }>()

    for (const list of lists) {
      if (list.status !== 'fulfilled') continue

      for (const hotel of list.value.hotels) {
        if (!matchesHotel(hotel.name, query)) continue

        const key = hotelKey(hotel.name)
        const entry = found.get(key) ?? { key, name: '', stars: null, suppliers: 0, names: new Map() }

        entry.names.set(hotel.name, (entry.names.get(hotel.name) ?? 0) + 1)
        entry.stars = entry.stars ?? hotel.stars
        entry.suppliers += 1
        found.set(key, entry)
      }
    }

    const needle = query.trim().toLowerCase()

    return [...found.values()]
      .map(({ names, ...entry }) => ({ ...entry, name: hotelLabel([...names].sort((a, b) => b[1] - a[1])[0]![0]) }))
      .sort((a, b) =>
        Number(b.name.toLowerCase().startsWith(needle)) - Number(a.name.toLowerCase().startsWith(needle))
        || b.suppliers - a.suppliers
        || a.name.localeCompare(b.name))
      .slice(0, limit)
  }

  async towns(from: string, to: string): Promise<ISupplierTown[]> {
    const lists = await Promise.allSettled(this.suppliers.map(supplier => supplier.towns?.(from, to) ?? Promise.resolve([])))
    const found = new Map<string, ISupplierTown>()

    for (const list of lists) {
      if (list.status !== 'fulfilled') continue

      for (const town of list.value) found.set(`${town.region}|${town.name}`, town)
    }

    return [...found.values()]
  }

  private async withAreas(criteria: SearchCriteria): Promise<SearchCriteria> {
    const areas = criteria.filters.areas ?? []

    if (!areas.length) return criteria

    const towns = resortTowns(await this.towns(criteria.from, criteria.to).catch(() => []), areas)

    return towns.length ? { ...criteria, filters: { ...criteria.filters, areas: towns } } : criteria
  }

  private native(): Set<string> {
    return new Set(this.suppliers.flatMap(s => s.capabilities.nativeFilters as string[]))
  }

  private applyLocalFilters(
    offers: Offer[],
    criteria: SearchCriteria,
  ): { offers: Offer[], appliedLocally: string[] } {
    const native = this.native()

    return {
      offers: localFilter(offers, criteria.filters, native),
      appliedLocally: activeLocalFacets(criteria.filters, native),
    }
  }

  private facetsOf(filtered: Offer[], raw: Offer[], criteria: SearchCriteria): SearchFacets {
    const native = this.native()

    return buildFacets(filtered, 100, {
      stars: localFilter(raw, criteria.filters, native, 'stars'),
      meals: localFilter(raw, criteria.filters, native, 'meals'),
      districts: localFilter(raw, criteria.filters, native, 'resorts'),
    })
  }
}
