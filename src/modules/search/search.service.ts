import { Inject, Injectable, Logger } from '@nestjs/common'
import { isUnsupported } from '~/modules/suppliers/base/contracts'
import { SUPPLIERS } from '~/modules/suppliers/base/tokens'
import { OperatorsService } from '~/modules/operators/operators.service'
import { SupplierState } from './contracts/search'
import type { ISupplier } from '~/modules/suppliers/base/contracts'
import type { Offer } from './models/Offer'
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

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name)

  constructor(
    @Inject(SUPPLIERS) private readonly suppliers: ISupplier[],
    private readonly operators: OperatorsService,
  ) {}

  /**
   * Only the operators the CMS has switched on. A supplier that is off is not
   * merely hidden from the filter — it is never asked, so nothing of theirs
   * can reach a result even if a stale request names it.
   */
  private async live(): Promise<ISupplier[]> {
    const enabled = new Set(await this.operators.enabledSlugs())

    return this.suppliers.filter(supplier => enabled.has(supplier.ref.id))
  }

  async fetchPage(criteria: SearchCriteria, page: number, signal?: AbortSignal): Promise<SearchPage> {
    const live = await this.live()

    const suppliers = criteria.filters.suppliers?.length
      ? live.filter(s => criteria.filters.suppliers.includes(s.ref.id))
      : live

    const results = await Promise.all(
      suppliers.map(async (supplier): Promise<{ status: SupplierStatus, offers: Offer[], hasMore: boolean }> => {
        const started = Date.now()

        try {
          const result = await supplier.fetchPage(criteria, page, signal)

          return {
            offers: result.offers,
            hasMore: result.hasMore,
            status: {
              supplier: supplier.ref,
              state: SupplierState.Done,
              offers: result.offers.length,
              tookMs: Date.now() - started,
            },
          }
        }
        catch (error) {
          const unsupported = isUnsupported(error)

          if (!unsupported) {
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
      }),
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
