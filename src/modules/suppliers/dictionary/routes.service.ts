import { Injectable, Logger } from '@nestjs/common'
import { slugify } from './slug'
import { COUNTRY_LABELS } from './dictionary.seed'
import type { ReferenceItem } from './dictionary.contracts'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
interface CachedRoutes {
  items: ReferenceItem[]
  fetchedAt: number
}

export interface RouteFacts {
  calendar: { start: string, valid: string } | null
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

  private numbers(html: string, name: string): number[] {
    const select = new RegExp(`<select[^>]*name="${name}"[^>]*>([\\s\\S]*?)</select>`).exec(html)
    if (!select) return []

    return [...select[1].matchAll(/<option[^>]*value="(\d+)"/g)]
      .map(match => Number(match[1]))
      .filter(Number.isFinite)
      .sort((a, b) => a - b)
  }
  private readonly inFlight = new Map<string, Promise<ReferenceItem[]>>()

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

  async calendarFor(
    supplierId: string,
    departureCode: string,
    countryCode: string,
    baseUrl: string,
    fetchPage: (url: string) => Promise<string>,
  ): Promise<RouteFacts | null> {
    const key = `cal:${supplierId}:${departureCode}:${countryCode}`
    const cached = this.calendars.get(key)
    if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.mask

    try {
      const html = await fetchPage(
        `${baseUrl}?TOWNFROMINC=${departureCode}&STATEINC=${countryCode}`)

      const attr = /data-calendar=(["'])([\s\S]*?)\1/.exec(html)

      if (!attr) {
        this.calendars.set(key, { mask: null, fetchedAt: Date.now() })
        return null
      }

      const decoded = attr[2].replace(/&quot;/g, '"').replace(/&amp;/g, '&')
      const parsed = JSON.parse(decoded) as { valid?: string, start?: string }

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
        `route ${supplierId} ${departureCode}→${countryCode}: `
        + `${mask.calendar ? `${mask.calendar.valid.length} days from ${mask.calendar.start}` : 'no calendar'}, `
        + `nights ${mask.nights.join('/')}, up to ${mask.maxAdults} adults`)

      return mask
    }
    catch (error) {
      this.logger.warn(`calendar ${supplierId} ${departureCode}→${countryCode} failed: ${String(error)}`)
      return cached?.mask ?? null
    }
  }

  async forDeparture(
    supplierId: string,
    departureCode: string,
    baseUrl: string,
    fetchPage: (url: string) => Promise<string>,
  ): Promise<ReferenceItem[]> {
    const key = `${supplierId}:${departureCode}`

    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.items

    const running = this.inFlight.get(key)
    if (running) return running

    const task = (async () => {
      try {
        const html = await fetchPage(`${baseUrl}?TOWNFROMINC=${departureCode}`)
        const items = this.parse(html)

        this.cache.set(key, { items, fetchedAt: Date.now() })
        this.logger.log(`routes for ${key}: ${items.length} destinations`)

        return items
      }
      catch (error) {
        this.logger.warn(`routes for ${key} failed: ${String(error)}`)
        return cached?.items ?? []
      }
      finally {
        this.inFlight.delete(key)
      }
    })()

    this.inFlight.set(key, task)
    return task
  }
}
