import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Injectable, Logger } from '@nestjs/common'
import { COUNTRY_LABELS, DEPARTURE_LABELS } from './dictionary.seed'
import type { ReferenceItem, RouteAnswer } from './dictionary.contracts'
import type { RouteConstraints } from '~/modules/suppliers/base/contracts'

interface RefOption { value: string, label: string }
interface RefData { selects: Record<string, RefOption[]> }

/**
 * Translates our slugs into a supplier's numeric codes.
 *
 * This is the piece that makes an Intention fallible: `TOWNFROMINC=26` is not
 * derivable from the string "tashkent", it is a fact harvested from their
 * form. When a slug has no code, the supplier genuinely cannot serve the
 * search and must say so — silently returning nothing is indistinguishable
 * from having no availability, which is exactly the confusion §4's supplier
 * status row exists to prevent.
 *
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class DictionaryService {
  private readonly logger = new Logger(DictionaryService.name)
  private readonly byLabel = new Map<string, Map<string, string>>()
  private readonly options = new Map<string, RefOption[]>()

  constructor() {
    this.load(join(__dirname, '../fixtures/kompastour-refdata.json'))
  }

  private load(path: string): void {
    const data = JSON.parse(readFileSync(path, 'utf8')) as RefData

    for (const [field, options] of Object.entries(data.selects ?? {})) {
      this.options.set(field, options)
      this.byLabel.set(
        field,
        new Map(options.map(o => [o.label.trim().toLowerCase(), o.value])),
      )
    }

    this.logger.log(`reference data loaded: ${[...this.options.keys()].join(', ')}`)
  }

  private resolve(field: string, aliases: string[] | undefined): string | null {
    if (!aliases) return null
    const lookup = this.byLabel.get(field)
    if (!lookup) return null

    for (const alias of aliases) {
      const code = lookup.get(alias.trim().toLowerCase())
      if (code) return code
    }

    return null
  }

  /**
   * The departure this reference dump was harvested with.
   *
   * It matters because the form is cascading: with Tashkent selected it offers
   * 28 destinations, with Vienna only 3. So a country list is only truthful
   * for the departure it was captured under, and everything else is a guess we
   * must label as one.
   */
  private readonly harvestedFor = 'tashkent'

  /** Slug for a supplier label, or null when we have never seen it. */
  private slugFor(map: Record<string, string[]>, label: string): string | null {
    const needle = label.trim().toLowerCase()

    for (const [slug, aliases] of Object.entries(map)) {
      if (aliases.some(alias => alias.trim().toLowerCase() === needle)) return slug
    }

    return null
  }

  /** Every departure city we can translate — the search box's «Откуда». */
  departures(): ReferenceItem[] {
    return (this.options.get('TOWNFROMINC') ?? [])
      .map(option => ({
        slug: this.slugFor(DEPARTURE_LABELS, option.label),
        label: option.label,
        code: option.value,
      }))
      // A city with no slug cannot be put in a URL or matched across
      // suppliers, so offering it would produce an unrunnable search.
      .filter((item): item is ReferenceItem => item.slug !== null)
  }

  /**
   * Destinations reachable from a departure.
   *
   * `verified` is the honest part: true only for the departure this dump was
   * harvested under. For any other city we return what we know and admit we
   * have not checked — better than silently implying Bukhara flies everywhere
   * Tashkent does.
   */
  countries(from?: string): RouteAnswer {
    const items = (this.options.get('STATEINC') ?? [])
      .map(option => ({
        slug: this.slugFor(COUNTRY_LABELS, option.label),
        label: option.label,
        code: option.value,
      }))
      .filter((item): item is ReferenceItem => item.slug !== null)

    return {
      items,
      verified: !from || from === this.harvestedFor,
      harvestedFor: this.harvestedFor,
    }
  }

  departureCode(slug: string): string | null {
    return this.resolve('TOWNFROMINC', DEPARTURE_LABELS[slug])
  }

  countryCode(slug: string): string | null {
    return this.resolve('STATEINC', COUNTRY_LABELS[slug])
  }

  /**
   * Constraints for a route.
   *
   * Harvested reference data is per-route by nature: the same form offers
   * nights 2–14 and four adults out of Tashkent, but 4–15 with 9 missing and
   * three adults out of Vienna. Serving one global list would let an agent
   * pick a value that can never return anything.
   */
  routeConstraints(_from?: string, _to?: string): RouteConstraints {
    const numbers = (field: string) =>
      (this.options.get(field) ?? [])
        .map(o => Number(o.value))
        .filter(Number.isFinite)

    const nights = numbers('NIGHTS_FROM')
    const adults = numbers('ADULT')
    const children = numbers('CHILD')

    return {
      // Harvested from a static form dump, which carries no calendar mask.
      // The live form ships one in CHECKIN_BEG's data-calendar attribute.
      validCheckIn: null,
      nights: nights.sort((a, b) => a - b),
      maxAdults: adults.length ? Math.max(...adults) : 1,
      maxChildren: children.length ? Math.max(...children) : 0,
    }
  }
}
