import { Inject, Injectable, Logger } from '@nestjs/common'
import { isUnsupported } from '~/modules/suppliers/base/contracts'
import { SUPPLIERS } from '~/modules/suppliers/base/tokens'
import { SupplierState } from './contracts/search'
import type { ISupplier } from '~/modules/suppliers/base/contracts'
import type { Offer } from './models/Offer'
import type { SearchCriteria, SupplierStatus } from './contracts/search'

/**
 * Fans a search out to every supplier and streams what comes back.
 *
 * Waves, not a barrier. §4: «Результаты приходят волнами, а не все сразу…
 * ждать всех — значит работать со скоростью самого медленного». So this is an
 * async generator: each supplier's pages are emitted as they arrive, together
 * with a status row saying who has answered and who has not.
 *
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface SearchUpdate {
  statuses: SupplierStatus[]
  /** offers new in this wave, already deduped within their supplier */
  offers: Offer[]
  done: boolean
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name)

  constructor(@Inject(SUPPLIERS) private readonly suppliers: ISupplier[]) {}

  async* search(
    criteria: SearchCriteria,
    signal?: AbortSignal,
    maxPages?: number,
  ): AsyncIterable<SearchUpdate> {
    const statuses = new Map<string, SupplierStatus>(
      this.suppliers.map(s => [
        s.ref.id,
        { supplier: s.ref, state: SupplierState.Pending, offers: 0 },
      ]),
    )

    const snapshot = () => [...statuses.values()].map(s => ({ ...s }))

    // Tell the client who we are waiting for before any of them answer, so the
    // status row is populated from the first frame.
    yield { statuses: snapshot(), offers: [], done: false }

    const queue: SearchUpdate[] = []
    let wake: (() => void) | null = null
    const push = (update: SearchUpdate) => {
      queue.push(update)
      wake?.()
    }

    const runners = this.suppliers.map(async (supplier) => {
      const started = Date.now()
      const status = statuses.get(supplier.ref.id)!
      status.state = SupplierState.Searching

      try {
        for await (const page of supplier.search(criteria, signal, maxPages)) {
          status.offers += page.offers.length
          push({ statuses: snapshot(), offers: page.offers, done: false })
        }

        status.state = SupplierState.Done
      }
      catch (error) {
        // A supplier that cannot serve this route is not a failure — it is a
        // fact the agent should see, phrased differently from a crash.
        if (isUnsupported(error)) {
          status.state = SupplierState.Unsupported
          status.reason = error.reason
        }
        else {
          status.state = SupplierState.Failed
          status.reason = error instanceof Error ? error.message : 'unknown error'
          this.logger.error(`${supplier.ref.id} failed: ${status.reason}`)
        }
      }
      finally {
        status.tookMs = Date.now() - started
        push({ statuses: snapshot(), offers: [], done: false })
      }
    })

    const all = Promise.allSettled(runners).then(() => { push({ statuses: snapshot(), offers: [], done: true }) })

    for (;;) {
      if (queue.length) {
        const update = queue.shift()!
        yield update
        if (update.done) break
        continue
      }

      await new Promise<void>((resolve) => { wake = resolve })
      wake = null
    }

    await all
  }
}
