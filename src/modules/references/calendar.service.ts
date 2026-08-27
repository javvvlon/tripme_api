import { Inject, Injectable } from '@nestjs/common'
import { SUPPLIERS } from '~/modules/suppliers/base/tokens'
import type { ISupplier } from '~/modules/suppliers/base/contracts'
import type { RouteFacts } from '~/modules/suppliers/dictionary/routes.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface CalendarMask {
  start: string
  horizon: string
  blocked: string[]
  scheduledUntil: string
}

@Injectable()
export class CalendarService {
  constructor(@Inject(SUPPLIERS) private readonly suppliers: ISupplier[]) {}

  async factsFor(from?: string, to?: string): Promise<RouteFacts | null> {
    if (!from || !to) return null

    const facts = (await Promise.all(
      this.suppliers.map(s => s.routeFacts(from, to).catch(() => null)),
    )).filter(Boolean) as RouteFacts[]

    if (!facts.length) return null

    return {
      calendar: facts.find(f => f.calendar)?.calendar ?? null,
      nights: [...new Set(facts.flatMap(f => f.nights))].sort((a, b) => a - b),
      maxAdults: Math.max(...facts.map(f => f.maxAdults)),
      maxChildren: Math.max(...facts.map(f => f.maxChildren)),
    }
  }

  async forRoute(from?: string, to?: string): Promise<CalendarMask | null> {
    if (!from || !to) return null

    const facts = (await Promise.all(
      this.suppliers.map(s => s.routeFacts(from, to).catch(() => null)),
    )).filter(Boolean) as RouteFacts[]

    const masks = facts.map(f => f.calendar).filter(Boolean) as Array<{ start: string, valid: string }>

    if (!masks.length) return null

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
      scheduledUntil: at(lastBlocked + 1),
      blocked,
    }
  }
}
