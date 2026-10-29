import { Inject, Injectable } from '@nestjs/common'
import { SUPPLIERS } from '~/modules/suppliers/base/tokens'
import type { ISupplier } from '~/modules/suppliers/base/contracts'
import type { ReferenceItem, RouteAnswer } from '~/modules/suppliers/dictionary/dictionary.contracts'
import type { ProductMode } from '~/modules/search/contracts/search'
import { OperatorsService } from '~/modules/operators/operators.service'
import { byHomeFirst, isAsianDeparture } from './departure-countries'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class RouteLookupService {
  constructor(
    @Inject(SUPPLIERS) private readonly suppliers: ISupplier[],
    private readonly operators: OperatorsService,
  ) {}

  async departures(): Promise<{ items: ReferenceItem[] }> {
    const lists = await Promise.all(
      this.suppliers.map(supplier => supplier.departures().catch(() => [] as ReferenceItem[])),
    )

    const items = merge(lists.flat())
      .filter(item => isAsianDeparture(item.slug))
      .sort(byHomeFirst)

    return { items }
  }

  async countriesFrom(from?: string): Promise<RouteAnswer> {
    if (!from) return { items: [], from: null }

    const lists = await Promise.all(
      this.suppliers.map(supplier =>
        supplier.destinationsFrom(from).catch(() => [] as ReferenceItem[])),
    )

    return { items: merge(lists.flat()), from }
  }

  async productCountries(mode: ProductMode): Promise<RouteAnswer> {
    const enabled = new Set(await this.operators.enabledSlugs().catch(() => [] as string[]))

    const lists = await Promise.all(
      this.suppliers
        .filter(supplier => enabled.has(supplier.ref.id))
        .map(supplier => supplier.productCountries?.(mode).catch(() => [] as ReferenceItem[]) ?? Promise.resolve([])),
    )

    return { items: merge(lists.flat()), from: null }
  }
}

function merge(items: ReferenceItem[]): ReferenceItem[] {
  const byslug = new Map<string, ReferenceItem>()

  for (const item of items) {
    if (!byslug.has(item.slug)) byslug.set(item.slug, item)
  }

  return [...byslug.values()].sort((a, b) => a.label.localeCompare(b.label, 'ru'))
}
