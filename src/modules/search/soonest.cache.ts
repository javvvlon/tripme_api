import { Injectable } from '@nestjs/common'
import type { SoonestDeparture } from './search.service'
import type { SearchCriteria } from './contracts/search'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const SOONEST_TTL_MS = 10 * 60 * 1000

const MAX_ENTRIES = 500

interface IEntry {
  answer: Promise<SoonestDeparture>
  storedAt: number
}

/**
 * Remembers which day a route is selling from.
 *
 * Every visitor arriving from the same card asks the same question, and
 * answering it costs a fan-out across every operator. The promise is stored
 * rather than the result, so a hundred arrivals at once share one flight of
 * requests instead of starting a hundred.
 */
@Injectable()
export class SoonestCache {
  private readonly entries = new Map<string, IEntry>()

  private key(criteria: SearchCriteria): string {
    return [
      criteria.from,
      criteria.to,
      criteria.dateFrom,
      criteria.nightsFrom,
      criteria.nightsTo,
      criteria.adults,
      criteria.childrenAges.join('.'),
      criteria.currency,
    ].join('|')
  }

  async through(
    criteria: SearchCriteria,
    resolve: () => Promise<SoonestDeparture>,
    now = Date.now(),
  ): Promise<SoonestDeparture> {
    const key = this.key(criteria)
    const held = this.entries.get(key)

    if (held && now - held.storedAt < SOONEST_TTL_MS) return held.answer

    const answer = resolve()

    this.entries.set(key, { answer, storedAt: now })

    /**
     * A question that failed must not be remembered as an answer, or the
     * route stays broken for the whole window.
     */
    answer.catch(() => {
      if (this.entries.get(key)?.answer === answer) this.entries.delete(key)
    })

    this.evict(now)

    return answer
  }

  private evict(now: number): void {
    for (const [key, entry] of this.entries) {
      if (now - entry.storedAt >= SOONEST_TTL_MS) this.entries.delete(key)
    }

    while (this.entries.size > MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value

      if (oldest === undefined) break

      this.entries.delete(oldest)
    }
  }
}
