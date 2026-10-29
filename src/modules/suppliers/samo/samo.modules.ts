import { COUNTRY_LABELS, DEPARTURE_LABELS } from '~/modules/suppliers/dictionary/dictionary.seed'
import { parseSelect, referenceItems } from '~/modules/suppliers/dictionary/supplier-dictionary'
import type { RefOption } from '~/modules/suppliers/dictionary/supplier-dictionary'
import type { ReferenceItem } from '~/modules/suppliers/dictionary/dictionary.contracts'
import type { ProductMode } from '~/modules/search/contracts/search'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const MODULE_PATHS: Record<ProductMode, string> = {
  hotels: 'search_hotel',
  excursions: 'search_excursion',
}

export interface ISamoModuleForm {
  countries: ReferenceItem[]
  departures: ReferenceItem[]
  currencies: RefOption[]
}

export interface ISamoDeparture {
  code: string
  landOnly: boolean
}

const LAND_ONLY = /наземн|без\s+перел[её]т|land\s*only/i

export const isLandOnly = (label: string): boolean => LAND_ONLY.test(label)

const TRANSFER_ONLY = /\btransfer\b|трансфер/i

export const isTransferOnly = (hotelName: string): boolean => TRANSFER_ONLY.test(hotelName)

export function moduleUrl(tourUrl: string, mode: ProductMode): string {
  return tourUrl.replace(/search_tour\/?$/, MODULE_PATHS[mode])
}

export function isModulePage(html: string, mode: ProductMode): boolean {
  return new RegExp(`ROOT_URL\\s*=\\s*"\\\\?/${MODULE_PATHS[mode]}\\?`).test(html)
}

export function parseModuleForm(html: string): ISamoModuleForm {
  return {
    countries: referenceItems(parseSelect(html, 'STATEINC'), COUNTRY_LABELS),
    departures: referenceItems(parseSelect(html, 'TOWNFROMINC'), DEPARTURE_LABELS),
    currencies: parseSelect(html, 'CURRENCY'),
  }
}

export function pickCurrency(offered: RefOption[], wanted: string | undefined): string | undefined {
  if (!offered.length || offered.some(option => option.value === wanted)) return wanted

  return (offered.find(option => option.label.trim().toUpperCase() === 'USD') ?? offered[0])!.value
}

export function pickDeparture(departures: ReferenceItem[], from: string): ISamoDeparture | null {
  const chosen = departures.find(item => item.slug === from)
    ?? departures.find(item => isLandOnly(item.label))
    ?? departures[0]

  return chosen ? { code: chosen.code, landOnly: isLandOnly(chosen.label) } : null
}
