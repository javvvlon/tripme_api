import { Intention } from '~/shared/helpers/intention'
import { Unsupported } from '~/modules/suppliers/base/contracts'
import { CURRENCY_CODES } from '~/modules/suppliers/dictionary/dictionary.seed'
import type { SearchCriteria } from '~/modules/search/contracts/search'

export interface ResolvedRoute {
  townFrom: string
  state: string
}

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class SamoSearchIntention extends Intention<SearchCriteria, Record<string, string> | Unsupported> {
  constructor(
    private readonly route: ResolvedRoute,
    private readonly page: number,
    private readonly constants: Record<string, string> = {},
  ) {
    super()
  }

  toRequest(criteria: SearchCriteria): Record<string, string> | Unsupported {
    const { townFrom, state } = this.route

    const currency = CURRENCY_CODES[criteria.currency]
    if (!currency) return new Unsupported(`currency ${criteria.currency} not offered`)

    const { filters } = criteria
    const list = (values: Array<string | number>) => values.join(',')

    const anyFlag = (values: unknown[]) => (values.length ? '0' : '1')

    return {
      samo_action: 'PRICESGROUP',
      TOWNFROMINC: townFrom,
      STATEINC: state,
      STATEFROM: this.constants.STATEFROM ?? '',
      CHECKIN_BEG: toSamoDate(criteria.dateFrom),
      CHECKIN_END: toSamoDate(criteria.dateTo),
      NIGHTS_FROM: String(criteria.nightsFrom),
      NIGHTS_TILL: String(criteria.nightsTo),
      ADULT: String(criteria.adults),
      CHILD: String(criteria.childrenAges.length),
      ...Object.fromEntries(criteria.childrenAges.map((age, i) => [`AGE${i + 1}`, String(age)])),
      CURRENCY: currency,

      TOWNS_ANY: '1',
      TOWNS: '',
      townssearch: '0',
      STARS_ANY: '1',
      STARS: '',
      HOTELS_ANY: anyFlag(filters.hotels),
      hotelsearch: '0',
      HOTELS: list(filters.hotels),
      MEALS_ANY: '1',
      MEALS: '',
      ROOMS_ANY: '1',
      ROOMS: '',

      ...(filters.priceMin !== undefined ? { COSTMIN: String(filters.priceMin) } : {}),
      ...(filters.priceMax !== undefined ? { COSTMAX: String(filters.priceMax) } : {}),

      PRICEPAGE: String(this.page),
      ...this.constants,
    }
  }
}

export function toSamoDate(iso: string): string {
  return iso.replaceAll('-', '')
}
