import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SamoSupplier } from './samo.supplier'
import { isUnsupported } from '~/modules/suppliers/base/contracts'
import type { ISupplierTransport, SupplierAccess } from '~/modules/suppliers/base/contracts'
import type { RoutesService } from '~/modules/suppliers/dictionary/routes.service'
import type { SearchCriteria, SupplierRef } from '~/modules/search/contracts/search'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const RESULTS = readFileSync(join(__dirname, '../fixtures/kompastour-tashkent-turkey-p1.txt'), 'utf8')

const formPage = (root: string, selects: string) => `<script>samo.ROOT_URL = "\\/${root}?";</script>${selects}`

const HOTEL_FORM = formPage('search_hotel', '<select name="STATEINC"><option value="17">Турция</option></select>')

const EXCURSION_FORM = formPage('search_excursion', '<select name="TOWNFROMINC"><option value="99">Наземное обслуживание</option></select>'
  + '<select name="STATEINC"><option value="17">Турция</option></select>')

class TestSupplier extends SamoSupplier {
  readonly ref: SupplierRef = { id: 'test', name: 'Test' }
  readonly access: SupplierAccess = 'undocumented'
  protected readonly baseUrl = 'https://op.test/search_tour'
  protected readonly constants: Record<string, string> = { STATEFROM: '14', FREIGHT: '1', PARTITION_PRICE: '160', CURRENCY: '2' }
}

function supplierWith(pages: Record<string, string>) {
  const asked: string[] = []
  const transport: ISupplierTransport = {
    fetch: async (url) => {
      asked.push(url)

      if (url.includes('samo_action=PRICESGROUP')) return RESULTS

      return pages[url] ?? ''
    },
  }

  return { supplier: new TestSupplier(transport, {} as RoutesService), asked }
}

const criteria = (mode: SearchCriteria['mode']): SearchCriteria => ({
  mode,
  from: mode === 'hotels' ? '' : 'tashkent',
  to: 'turkey',
  dateFrom: '2026-11-15',
  dateTo: '2026-11-17',
  nightsFrom: 7,
  nightsTo: 7,
  adults: 2,
  childrenAges: [],
  currency: 'USD',
  filters: { stars: [], meals: [], resorts: [], hotels: [], suppliers: [] },
})

describe('SAMO hotel and excursion search', () => {
  it('lists the countries of a working module and nothing for a redirect', async () => {
    const { supplier } = supplierWith({
      'https://op.test/search_hotel': HOTEL_FORM,
      'https://op.test/search_excursion': formPage('search_tour', '<select name="STATEINC"><option value="17">Турция</option></select>'),
    })

    expect(await supplier.productCountries('hotels')).toEqual([{ slug: 'turkey', label: 'Турция', code: '17' }])
    expect(await supplier.productCountries('excursions')).toEqual([])
  })

  it('searches hotels without a departure or the tour-only settings', async () => {
    const { supplier, asked } = supplierWith({ 'https://op.test/search_hotel': HOTEL_FORM })
    const page = await supplier.fetchPage(criteria('hotels'), 1)
    const search = new URL(asked.find(url => url.includes('PRICESGROUP'))!)

    expect(search.pathname).toBe('/search_hotel')
    expect(search.searchParams.get('STATEINC')).toBe('17')
    expect(search.searchParams.get('CURRENCY')).toBe('2')
    expect(search.searchParams.has('TOWNFROMINC')).toBe(false)
    expect(search.searchParams.has('STATEFROM')).toBe(false)
    expect(search.searchParams.has('FREIGHT')).toBe(false)
    expect(search.searchParams.has('PARTITION_PRICE')).toBe(false)

    expect(page.offers.length).toBeGreaterThan(0)
    expect(page.offers.every(offer => offer.get('product') === 'hotel' && offer.get('flightIncluded') === false)).toBe(true)
    expect(page.offers[0]!.get('bookingUrl')).toMatch(/^https:\/\/op\.test\/search_hotel\?/)
  })

  it('searches excursions from the land-only departure and marks them without a flight', async () => {
    const { supplier, asked } = supplierWith({ 'https://op.test/search_excursion': EXCURSION_FORM })
    const page = await supplier.fetchPage(criteria('excursions'), 1)
    const search = new URL(asked.find(url => url.includes('PRICESGROUP'))!)

    expect(search.pathname).toBe('/search_excursion')
    expect(search.searchParams.get('TOWNFROMINC')).toBe('99')
    expect(page.offers.every(offer => offer.get('product') === 'excursion')).toBe(true)
  })

  it('reports a country the module does not sell as unsupported', async () => {
    const { supplier } = supplierWith({ 'https://op.test/search_hotel': HOTEL_FORM })

    await expect(supplier.fetchPage({ ...criteria('hotels'), to: 'egypt' }, 1)).rejects.toSatisfy(isUnsupported)
  })

  it('still searches tours from the tour page', async () => {
    const { supplier, asked } = supplierWith({})

    await supplier.fetchPage(criteria(undefined), 1).catch(() => null)

    expect(asked.every(url => !url.includes('search_hotel') && !url.includes('search_excursion'))).toBe(true)
  })
})
