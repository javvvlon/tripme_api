import { Inject, Injectable, Logger } from '@nestjs/common'
import { isUnsupported } from '~/modules/suppliers/base/contracts'
import { SUPPLIERS } from '~/modules/suppliers/base/tokens'
import { SupplierState } from './contracts/search'
import type { ISupplier } from '~/modules/suppliers/base/contracts'
import type { Offer } from './models/Offer'
import type { SearchCriteria, SupplierStatus } from './contracts/search'

/**
 * Asks every supplier for the same page, at the same time.
 *
 * Parallel across suppliers, one page deep. That combination is the whole
 * design: §4 wants results in a few seconds and an honest row of who has
 * answered, and the slowness that made that hard was never the suppliers — it
 * was walking ten pages sequentially. Three suppliers × one page in parallel
 * costs about as long as the slowest single request.
 *
 * Depth is the agent's decision, made by scrolling, so a supplier only sees
 * requests a person actually caused.
 *
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface SearchPage {
  offers: Offer[]
  statuses: SupplierStatus[]
  page: number
  /** true when at least one supplier still has pages left */
  hasMore: boolean
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name)

  constructor(@Inject(SUPPLIERS) private readonly suppliers: ISupplier[]) {}

  async fetchPage(criteria: SearchCriteria, page: number, signal?: AbortSignal): Promise<SearchPage> {
    const results = await Promise.all(
      this.suppliers.map(async (supplier): Promise<{ status: SupplierStatus, offers: Offer[], hasMore: boolean }> => {
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
          // A supplier that cannot serve this route is not a failure — it is a
          // fact the agent should see, phrased differently from a crash.
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

    /**
     * Merged by price, because that is how every supplier sorts its own page
     * and how an agent reads the list.
     *
     * Honest caveat for when there is more than one supplier: this orders each
     * page correctly, but a cheap offer sitting on supplier B's page 2 can be
     * cheaper than things on supplier A's page 1. Exact global ordering needs
     * a price cursor, which SAMO does not offer.
     */
    const offers = results
      .flatMap(r => r.offers)
      .sort((a, b) => a.sortPrice() - b.sortPrice())

    return {
      offers,
      statuses: results.map(r => r.status),
      page,
      hasMore: results.some(r => r.hasMore),
    }
  }
}
