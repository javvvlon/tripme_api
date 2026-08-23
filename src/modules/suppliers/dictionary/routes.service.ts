import { Injectable, Logger } from '@nestjs/common'
import { slugify } from './slug'
import { COUNTRY_LABELS } from './dictionary.seed'
import type { ReferenceItem } from './dictionary.contracts'

/**
 * Which destinations are reachable from a given departure city.
 *
 * Read from the operator's own search page, because the cascade is real and
 * severe: Tashkent offers 27 countries, Samarkand 4, and Bukhara exactly one.
 * A previous version served Tashkent's list for every city with a "not
 * verified" note attached — which meant offering Bukhara eleven destinations
 * that can never return a result, and calling that honesty.
 *
 * One request per departure, cached for a working day. The list changes with
 * the season, not with the hour.
 *
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
interface CachedRoutes {
  items: ReferenceItem[]
  fetchedAt: number
}

/** Everything the search form needs about one route, read off one page. */
export interface RouteFacts {
  calendar: { start: string, valid: string } | null
  /** discrete, not a range — 9 nights can be genuinely absent */
  nights: number[]
  maxAdults: number
  maxChildren: number
}

const TTL_MS = 8 * 60 * 60 * 1000

@Injectable()
export class RoutesService {
  private readonly logger = new Logger(RoutesService.name)
  private readonly cache = new Map<string, CachedRoutes>()
  private readonly calendars = new Map<string, { mask: RouteFacts | null, fetchedAt: number }>()

  /** Numeric <option> values of a named select, in ascending order. */
  private numbers(html: string, name: string): number[] {
    const select = new RegExp(`<select[^>]*name="${name}"[^>]*>([\\s\\S]*?)</select>`).exec(html)
    if (!select) return []

    return [...select[1].matchAll(/<option[^>]*value="(\d+)"/g)]
      .map(match => Number(match[1]))
      .filter(Number.isFinite)
      .sort((a, b) => a - b)
  }
  private readonly inFlight = new Map<string, Promise<ReferenceItem[]>>()

  /**
   * Slug for a label, preferring the curated name so `turkey` stays `turkey`
   * rather than becoming `turtsiya`.
   */
  private slugFor(label: string): string {
    const needle = label.trim().toLowerCase()

    for (const [slug, aliases] of Object.entries(COUNTRY_LABELS)) {
      if (aliases.some(alias => alias.trim().toLowerCase() === needle)) return slug
    }

    return slugify(label)
  }

  private parse(html: string): ReferenceItem[] {
    const select = /<select[^>]*name="STATEINC"[^>]*>([\s\S]*?)<\/select>/.exec(html)
    if (!select) return []

    return [...select[1].matchAll(/<option[^>]*value="(\d+)"[^>]*>([^<]*)<\/option>/g)]
      .map(([, code, rawLabel]) => {
        const label = rawLabel.trim()
        return { slug: this.slugFor(label), label, code }
      })
      .filter(item => item.slug && item.label)
  }

  /**
   * The per-day check-in mask their form ships on CHECKIN_BEG:
   *
   *   data-calendar = {"valid":"50505555…","start":"23.08.2026"}
   *
   * One character per day from `start`. The alphabet varies by route — 0/5 on
   * one, 0/1/2/3 on another — and only `0` reliably means "does not fly", so
   * anything non-zero is treated as selectable rather than guessing what the
   * other digits grade.
   *
   * Without it the date picker offers every day of the year, the agent picks a
   * day nothing flies, and an empty result reads as a broken search.
   */
  async calendarFor(
    departureCode: string,
    countryCode: string,
    baseUrl: string,
    fetchPage: (url: string) => Promise<string>,
  ): Promise<RouteFacts | null> {
    const key = `cal:${departureCode}:${countryCode}`
    const cached = this.calendars.get(key)
    if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.mask

    try {
      const html = await fetchPage(
        `${baseUrl}?TOWNFROMINC=${departureCode}&STATEINC=${countryCode}`)

      // Single OR double quotes: this attribute is emitted with single quotes
      // on some routes and double on others, and matching only one silently
      // yields "no calendar published" rather than an error.
      const attr = /data-calendar=(["'])([\s\S]*?)\1/.exec(html)

      if (!attr) {
        this.calendars.set(key, { mask: null, fetchedAt: Date.now() })
        return null
      }


      const decoded = attr[2].replace(/&quot;/g, '"').replace(/&amp;/g, '&')
      const parsed = JSON.parse(decoded) as { valid?: string, start?: string }

      // Nights and party limits come off the same page, so they cost nothing
      // extra — and they are per-route too: 2–14 nights out of Tashkent,
      // 4–15 with 9 missing out of Vienna.
      const mask: RouteFacts = {
        calendar: parsed.valid && parsed.start
          ? { valid: parsed.valid, start: parsed.start }
          : null,
        nights: this.numbers(html, 'NIGHTS_FROM'),
        maxAdults: Math.max(...this.numbers(html, 'ADULT'), 1),
        maxChildren: Math.max(...this.numbers(html, 'CHILD'), 0),
      }

      this.calendars.set(key, { mask, fetchedAt: Date.now() })
      this.logger.log(
        `route ${departureCode}→${countryCode}: `
        + `${mask.calendar ? `${mask.calendar.valid.length} days from ${mask.calendar.start}` : 'no calendar'}, `
        + `nights ${mask.nights.join('/')}, up to ${mask.maxAdults} adults`)

      return mask
    }
    catch (error) {
      this.logger.warn(`calendar ${departureCode}→${countryCode} failed: ${String(error)}`)
      return cached?.mask ?? null
    }
  }

  async forDeparture(
    departureCode: string,
    baseUrl: string,
    fetchPage: (url: string) => Promise<string>,
  ): Promise<ReferenceItem[]> {
    const cached = this.cache.get(departureCode)
    if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.items

    // Two components asking at once must produce one request, not two.
    const running = this.inFlight.get(departureCode)
    if (running) return running

    const task = (async () => {
      try {
        const html = await fetchPage(`${baseUrl}?TOWNFROMINC=${departureCode}`)
        const items = this.parse(html)

        this.cache.set(departureCode, { items, fetchedAt: Date.now() })
        this.logger.log(`routes for departure ${departureCode}: ${items.length} destinations`)

        return items
      }
      catch (error) {
        this.logger.warn(`routes for departure ${departureCode} failed: ${String(error)}`)
        // Serve a stale list rather than an empty one — an outdated
        // destination is a failed search, an empty list is a broken product.
        return cached?.items ?? []
      }
      finally {
        this.inFlight.delete(departureCode)
      }
    })()

    this.inFlight.set(departureCode, task)
    return task
  }
}
