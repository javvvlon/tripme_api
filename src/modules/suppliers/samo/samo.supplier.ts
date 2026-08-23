import { BaseSupplier } from '~/modules/suppliers/base/supplier'
import { Unsupported, isUnsupported } from '~/modules/suppliers/base/contracts'
import { SamoSearchIntention } from './samo.intention'
import { parseSamoRows } from './samo.parser'
import { mapSamoRow } from './samo.map'
import type { DictionaryService } from '~/modules/suppliers/dictionary/dictionary.service'
import type { ISupplierTransport, SupplierCapabilities } from '~/modules/suppliers/base/contracts'
import type { SearchCriteria } from '~/modules/search/contracts/search'
import type { Offer } from '~/modules/search/models/Offer'
import type { SamoQuery, SamoRow } from './samo.contracts'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export abstract class SamoSupplier extends BaseSupplier<SamoQuery, SamoRow> {
  protected abstract readonly baseUrl: string
  protected abstract readonly constants: Record<string, string>

  readonly capabilities: SupplierCapabilities = {
    nativeFilters: ['stars', 'meals', 'resorts', 'hotels', 'priceMin', 'priceMax'],
    pageSize: 100,
    maxPages: 20,
    priceCursor: false,
    maxAdults: 4,
    maxChildren: 3,
    currencies: ['USD', 'EUR', 'UZS'],
  }

  constructor(transport: ISupplierTransport, protected readonly dictionary: DictionaryService) {
    super(transport)
  }

  protected buildQuery(criteria: SearchCriteria, page: number): SamoQuery | Unsupported {
    if (criteria.adults > this.capabilities.maxAdults) {
      return new Unsupported(`at most ${this.capabilities.maxAdults} adults`)
    }

    const params = new SamoSearchIntention(this.dictionary, page, this.constants).toRequest(criteria)

    if (isUnsupported(params)) return params

    return { params, baseUrl: this.baseUrl }
  }

  protected buildUrl(query: SamoQuery): string {
    const qs = new URLSearchParams(query.params).toString()
    return `${query.baseUrl}?${qs}`
  }

  protected parse(payload: string): SamoRow[] {
    return parseSamoRows(payload)
  }

  protected map(row: SamoRow, criteria: SearchCriteria): Offer | null {
    return mapSamoRow(row, criteria, this.ref)
  }
}
