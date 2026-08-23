import { Inject, Injectable } from '@nestjs/common'
import { SUPPLIERS } from '~/modules/suppliers/base/tokens'
import { DictionaryService } from '~/modules/suppliers/dictionary/dictionary.service'
import type { ISupplier } from '~/modules/suppliers/base/contracts'
import type { ReferenceItem, RouteAnswer } from '~/modules/suppliers/dictionary/dictionary.contracts'

/**
 * The destinations the search box may offer.
 *
 * The union across suppliers, for the chosen departure: if any supplier flies
 * Bukhara → Turkey, Turkey is offerable from Bukhara. Anything else would hide
 * inventory one operator genuinely sells.
 *
 * With no departure chosen yet, falls back to the harvested list so the field
 * is not empty before the agent has picked a city.
 *
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class RouteLookupService {
  constructor(
    @Inject(SUPPLIERS) private readonly suppliers: ISupplier[],
    private readonly dictionary: DictionaryService,
  ) {}

  async countriesFrom(from?: string): Promise<RouteAnswer> {
    if (!from) return { items: this.dictionary.countries(), from: null }

    const departureCode = this.dictionary.departureCode(from)
    if (!departureCode) return { items: [], from }

    const lists = await Promise.all(
      this.suppliers.map(supplier =>
        supplier.destinationsFrom(departureCode).catch(() => [] as ReferenceItem[])),
    )

    const merged = new Map<string, ReferenceItem>()
    for (const item of lists.flat()) merged.set(item.slug, item)

    const items = [...merged.values()].sort((a, b) => a.label.localeCompare(b.label, 'ru'))

    // Teach the dictionary the slug → code pairs we just learned, so a search
    // for one of them can be translated back.
    this.dictionary.rememberCountries(items)

    // An empty answer usually means the lookup failed rather than that nowhere
    // is reachable; the harvested list is a better guess than nothing.
    return items.length ? { items, from } : { items: this.dictionary.countries(), from }
  }
}
