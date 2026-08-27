import { Inject, Injectable } from '@nestjs/common'
import { SUPPLIERS } from '~/modules/suppliers/base/tokens'
import type { ISupplier } from '~/modules/suppliers/base/contracts'
import type { ReferenceItem, RouteAnswer } from '~/modules/suppliers/dictionary/dictionary.contracts'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class RouteLookupService {
  constructor(@Inject(SUPPLIERS) private readonly suppliers: ISupplier[]) {}

  async departures(): Promise<{ items: ReferenceItem[] }> {
    const lists = await Promise.all(
      this.suppliers.map(supplier => supplier.departures().catch(() => [] as ReferenceItem[])),
    )

    return { items: merge(lists.flat()) }
  }

  async countriesFrom(from?: string): Promise<RouteAnswer> {
    if (!from) return { items: [], from: null }

    const lists = await Promise.all(
      this.suppliers.map(supplier =>
        supplier.destinationsFrom(from).catch(() => [] as ReferenceItem[])),
    )

    return { items: merge(lists.flat()), from }
  }
}

function merge(items: ReferenceItem[]): ReferenceItem[] {
  const byslug = new Map<string, ReferenceItem>()

  for (const item of items) {
    if (!byslug.has(item.slug)) byslug.set(item.slug, item)
  }

  return [...byslug.values()].sort((a, b) => a.label.localeCompare(b.label, 'ru'))
}
