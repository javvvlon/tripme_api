import { Intention } from '~/shared/helpers/intention'
import { Unsupported } from '~/modules/suppliers/base/contracts'
import { CURRENCY_CODES } from '~/modules/suppliers/dictionary/dictionary.seed'
import type { DictionaryService } from '~/modules/suppliers/dictionary/dictionary.service'
import type { SearchCriteria } from '~/modules/search/contracts/search'

/**
 * Our criteria → SAMO's query parameters.
 *
 * Not a rename map. Four things make this a function rather than a dictionary:
 *
 *  - one of ours becomes two of theirs — `from: 'tashkent'` yields both
 *    TOWNFROMINC and STATEFROM;
 *  - scalars become ranges — one date becomes CHECKIN_BEG + CHECKIN_END;
 *  - "any" is a flag, not an empty value — sending TOWNS='' without
 *    TOWNS_ANY=1 is malformed, not unfiltered;
 *  - values need formatting — ISO 2026-09-03 becomes 20260903.
 *
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class SamoSearchIntention extends Intention<SearchCriteria, Record<string, string> | Unsupported> {
  constructor(
    private readonly dictionary: DictionaryService,
    private readonly page: number,
    /** operator-specific constants that are part of the request signature */
    private readonly constants: Record<string, string> = {},
  ) {
    super()
  }

  toRequest(criteria: SearchCriteria): Record<string, string> | Unsupported {
    const townFrom = this.dictionary.departureCode(criteria.from)
    if (!townFrom) return new Unsupported(`no departure code for "${criteria.from}"`)

    const state = this.dictionary.countryCode(criteria.to)
    if (!state) return new Unsupported(`no destination code for "${criteria.to}"`)

    const currency = CURRENCY_CODES[criteria.currency]
    if (!currency) return new Unsupported(`currency ${criteria.currency} not offered`)

    const { filters } = criteria
    const list = (values: Array<string | number>) => values.join(',')

    // "Any" is expressed by the *_ANY flag; the value field stays empty.
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

      // Resorts and stars are deliberately "any": our values are display
      // names and parsed numbers, not SAMO's TOWNS ids and category codes.
      // Sending them untranslated returns an empty page. They are applied
      // after the fetch instead — see SupplierCapabilities.nativeFilters.
      TOWNS_ANY: '1',
      TOWNS: '',
      townssearch: '0',
      STARS_ANY: '1',
      STARS: '',
      HOTELS_ANY: anyFlag(filters.hotels),
      hotelsearch: '0',
      HOTELS: list(filters.hotels),
      // Ignored by the endpoint when set from our meal codes — see
      // SupplierCapabilities.nativeFilters. Applied after the fetch instead.
      MEALS_ANY: '1',
      MEALS: '',
      ROOMS_ANY: '1',
      ROOMS: '',

      // Price bounds are native: filtering locally would filter the hundred
      // cheapest rows, because that is all a page contains.
      ...(filters.priceMin !== undefined ? { COSTMIN: String(filters.priceMin) } : {}),
      ...(filters.priceMax !== undefined ? { COSTMAX: String(filters.priceMax) } : {}),

      PRICEPAGE: String(this.page),
      ...this.constants,
    }
  }
}

/** 2026-09-03 → 20260903 */
export function toSamoDate(iso: string): string {
  return iso.replaceAll('-', '')
}
