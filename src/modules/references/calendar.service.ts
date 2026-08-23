import { Inject, Injectable } from '@nestjs/common'
import { SUPPLIERS } from '~/modules/suppliers/base/tokens'
import { DictionaryService } from '~/modules/suppliers/dictionary/dictionary.service'
import type { ISupplier } from '~/modules/suppliers/base/contracts'
import type { RouteFacts } from '~/modules/suppliers/dictionary/routes.service'

/**
 * Which dates a route can actually be booked for.
 *
 * SAMO publishes this as a per-day mask on its own search form — one character
 * per day from a start date, `0` meaning the programme does not fly. Charter
 * and GDS schedules are not daily: Tashkent→Egypt returns a hundred offers on
 * 15.09 and nothing at all on 01.09 or 05.10.
 *
 * Without it a date picker offers every day of the year, the agent lands on a
 * day nothing flies, and an empty result reads as a broken search rather than
 * as "not that day".
 *
 * A route where nobody publishes a mask answers null, and the picker falls
 * back to "any future date" — offering too much is better than blocking a day
 * that would have worked.
 *
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface CalendarMask {
  start: string
  horizon: string
  /** ISO dates the supplier will not accept as check-in */
  blocked: string[]
  /** past this date the schedule is not loaded, so "open" means "unknown" */
  scheduledUntil: string
}

@Injectable()
export class CalendarService {
  constructor(
    @Inject(SUPPLIERS) private readonly suppliers: ISupplier[],
    private readonly dictionary: DictionaryService,
  ) {}

  /** Nights, party limits and calendar for a route — all from the supplier. */
  async factsFor(from?: string, to?: string): Promise<RouteFacts | null> {
    if (!from || !to) return null

    const departureCode = this.dictionary.departureCode(from)
    const countryCode = this.dictionary.countryCode(to)
    if (!departureCode || !countryCode) return null

    const facts = (await Promise.all(
      this.suppliers.map(s => s.routeFacts(departureCode, countryCode).catch(() => null)),
    )).filter(Boolean) as RouteFacts[]

    if (!facts.length) return null

    // Union across suppliers: a night count one of them sells is sellable.
    return {
      calendar: facts.find(f => f.calendar)?.calendar ?? null,
      nights: [...new Set(facts.flatMap(f => f.nights))].sort((a, b) => a - b),
      maxAdults: Math.max(...facts.map(f => f.maxAdults)),
      maxChildren: Math.max(...facts.map(f => f.maxChildren)),
    }
  }

  async forRoute(from?: string, to?: string): Promise<CalendarMask | null> {
    if (!from || !to) return null

    const departureCode = this.dictionary.departureCode(from)
    const countryCode = this.dictionary.countryCode(to)
    if (!departureCode || !countryCode) return null

    const facts = (await Promise.all(
      this.suppliers.map(s => s.routeFacts(departureCode, countryCode).catch(() => null)),
    )).filter(Boolean) as RouteFacts[]

    const masks = facts.map(f => f.calendar).filter(Boolean) as Array<{ start: string, valid: string }>

    if (!masks.length) return null

    // With several suppliers a day is bookable if ANY of them flies it, so the
    // blocked set is the intersection.
    return this.merge(masks)
  }

  private merge(masks: Array<{ start: string, valid: string }>): CalendarMask {
    const parsed = masks.map(mask => this.decode(mask))

    const blocked = parsed[0].blocked.filter(date =>
      parsed.every(other => other.blocked.includes(date)))

    return {
      start: parsed.map(p => p.start).sort()[0],
      horizon: parsed.map(p => p.horizon).sort().at(-1)!,
      scheduledUntil: parsed.map(p => p.scheduledUntil).sort().at(-1)!,
      blocked,
    }
  }

  private decode(mask: { start: string, valid: string }): CalendarMask {
    const [day, month, year] = mask.start.split('.').map(Number)
    const start = new Date(Date.UTC(year, month - 1, day))

    const at = (offset: number) => {
      const date = new Date(start)
      date.setUTCDate(date.getUTCDate() + offset)
      return date.toISOString().slice(0, 10)
    }

    const blocked: string[] = []
    let lastBlocked = -1

    ;[...mask.valid].forEach((flag, offset) => {
      if (flag === '0') {
        blocked.push(at(offset))
        lastBlocked = offset
      }
    })

    return {
      start: at(0),
      horizon: at(mask.valid.length - 1),
      // Past the last blocked day the mask is uniformly open, which means the
      // schedule simply is not loaded that far out — not that it is available.
      scheduledUntil: at(lastBlocked + 1),
      blocked,
    }
  }
}
