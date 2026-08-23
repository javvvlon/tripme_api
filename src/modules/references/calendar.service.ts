import { Injectable } from '@nestjs/common'

/**
 * Which dates a supplier will accept as check-in.
 *
 * SAMO ships this on its own search form as a per-day mask on CHECKIN_BEG:
 *
 *   data-calendar = {"valid":"50505555050555…","start":"23.08.2026"}
 *
 * One character per day from `start`, `5` selectable and `0` blocked. Captured
 * live for Vienna→Maldives it blocks every Monday and Wednesday for six weeks
 * and then opens completely — which is charter scheduling, and the reason a
 * free date picker would let agents choose days that can never return a result.
 *
 * The open tail is almost certainly "schedule not loaded yet" rather than
 * "guaranteed available", so it is reported as an horizon the UI can grey out
 * beyond, not as a promise.
 *
 * Only one route has been harvested so far. Everything else answers null, and
 * the picker falls back to "any future date" rather than inventing a schedule.
 *
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface CalendarMask {
  /** ISO date the mask starts at */
  start: string
  /** ISO date of the last day the supplier has scheduled */
  horizon: string
  /** ISO dates that cannot be chosen, within the scheduled window */
  blocked: string[]
  /** where the mask stops being informative and becomes optimistic */
  scheduledUntil: string
  route: string
}

/** Captured from the live form, 2026-08-23, TOWNFROMINC=538 → STATEINC=40. */
const VIENNA_MALDIVES =
  '5050555505055550505555050555505055550505555055555555555555555555555555555555555'
  + '5555555555555555555555555555555555555555555555555555555555555555555555555555555'
  + '55555555555555555555555555555555555555555555555555555555555'

const HARVESTED: Record<string, { start: string, valid: string }> = {
  'vienna:maldives': { start: '2026-08-23', valid: VIENNA_MALDIVES },
}

@Injectable()
export class CalendarService {
  forRoute(from?: string, to?: string): CalendarMask | null {
    const key = `${from}:${to}`
    const harvested = HARVESTED[key]
    if (!harvested) return null

    const start = new Date(`${harvested.start}T00:00:00Z`)
    const blocked: string[] = []
    let lastBlocked = -1

    ;[...harvested.valid].forEach((flag, offset) => {
      if (flag !== '0') return

      const day = new Date(start)
      day.setUTCDate(day.getUTCDate() + offset)
      blocked.push(day.toISOString().slice(0, 10))
      lastBlocked = offset
    })

    const at = (offset: number) => {
      const day = new Date(start)
      day.setUTCDate(day.getUTCDate() + offset)
      return day.toISOString().slice(0, 10)
    }

    return {
      start: harvested.start,
      horizon: at(harvested.valid.length - 1),
      blocked,
      // Past the last blocked day the mask is all-open, which reads as
      // "unknown" rather than "available".
      scheduledUntil: at(lastBlocked + 1),
      route: key,
    }
  }
}
