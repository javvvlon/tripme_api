import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Injectable, Logger } from '@nestjs/common'
import { COUNTRY_LABELS, DEPARTURE_LABELS } from './dictionary.seed'
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
  routeConstraints(): RouteConstraints {
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
