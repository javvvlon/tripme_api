import { Inject, Injectable, Logger } from '@nestjs/common'
import { isUnsupported } from '~/modules/suppliers/base/contracts'
import { SUPPLIERS } from '~/modules/suppliers/base/tokens'
import { OperatorsService } from '~/modules/operators/operators.service'
import { SupplierState } from './contracts/search'
import type { ISupplier } from '~/modules/suppliers/base/contracts'
import { Observable } from 'rxjs'
import { buildFacets } from './facets'
import type { Offer } from './models/Offer'
import type { SearchFacets } from './facets'
import type { SearchCriteria, SupplierStatus } from './contracts/search'

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

const cheapestPerId = (offers: Offer[]): Offer[] => {
  const byId = new Map<string, Offer>()

  for (const offer of offers) {
    const seen = byId.get(offer.get('id'))

    if (!seen || offer.sortPrice() < seen.sortPrice()) byId.set(offer.get('id'), offer)
  }

  return [...byId.values()]
}

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
  ) {}

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

    try {
      const result = await supplier.fetchPage(criteria, page, signal)
      const offers = cheapestPerId(result.offers)

      return {
        offers,
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

  async fetchPage(criteria: SearchCriteria, page: number, signal?: AbortSignal): Promise<SearchPage> {
    const suppliers = await this.suppliersFor(criteria)

    const results = await Promise.all(
      suppliers.map(supplier => this.runSupplier(supplier, criteria, page, signal)),
    )

    const merged = results
      .flatMap(r => r.offers)
      .sort((a, b) => a.sortPrice() - b.sortPrice())

    const { offers, appliedLocally } = this.applyLocalFilters(merged, criteria)

    return {
      offers,
      statuses: results.map(r => r.status),
      page,
      hasMore: results.some(r => r.hasMore),
      appliedLocally,
    }
  }

  stream(criteria: SearchCriteria): Observable<SearchStreamEvent> {
    return new Observable<SearchStreamEvent>((subscriber) => {
      const abort = new AbortController()

      void (async () => {
        const suppliers = await this.suppliersFor(criteria)

        const statuses = new Map<string, SupplierStatus>(suppliers.map(supplier => [
          supplier.ref.id,
          { supplier: supplier.ref, state: SupplierState.Searching, offers: 0 },
        ]))

        const snapshot = () => [...statuses.values()]

        subscriber.next({ type: 'start', statuses: snapshot() })

        let all: Offer[] = []
        let hasMore = false
        let appliedLocally: string[] = []

        await Promise.all(suppliers.map(async (supplier) => {
          const run = await this.runSupplier(supplier, criteria, 1, abort.signal)

          if (abort.signal.aborted) return

          const local = this.applyLocalFilters(run.offers, criteria)

          appliedLocally = local.appliedLocally
          hasMore = hasMore || run.hasMore
          all = [...all, ...local.offers].sort((a, b) => a.sortPrice() - b.sortPrice())
          statuses.set(supplier.ref.id, { ...run.status, offers: local.offers.length })

          subscriber.next({
            type: 'offers',
            statuses: snapshot(),
            items: local.offers.map(offer => offer.toObject()),
            facets: buildFacets(all, 100),
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

  private applyLocalFilters(
    offers: Offer[],
    criteria: SearchCriteria,
  ): { offers: Offer[], appliedLocally: string[] } {
    const native = new Set(this.suppliers.flatMap(s => s.capabilities.nativeFilters as string[]))
    const applied: string[] = []
    let result = offers

    const { stars, resorts, meals } = criteria.filters

    if (stars?.length && !native.has('stars')) {
      applied.push('stars')
      result = result.filter(o => stars.includes(o.get('hotelStars') ?? 0))
    }

    if (resorts?.length && !native.has('resorts')) {
      applied.push('resorts')
      result = result.filter(o => resorts.includes(o.get('district') ?? ''))
    }

    if (meals?.length && !native.has('meals')) {
      applied.push('meals')
      result = result.filter(o => meals.includes(o.get('mealCode') ?? ''))
    }

    return { offers: result, appliedLocally: applied }
  }
}
