import { describe, expect, it } from 'vitest'
import { isLandOnly, isModulePage, isTransferOnly, moduleUrl, parseModuleForm, pickCurrency, pickDeparture } from './samo.modules'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const page = (root: string, selects = '') => `<script>samo.ROOT_URL = "\\/${root}?";</script>${selects}`

describe('SAMO modules', () => {
  it('turns the tour address into a module address', () => {
    expect(moduleUrl('https://online.uz.kompastour.com/search_tour', 'hotels')).toBe('https://online.uz.kompastour.com/search_hotel')
    expect(moduleUrl('https://b2b.flykhiva.travel/search_tour', 'excursions')).toBe('https://b2b.flykhiva.travel/search_excursion')
  })

  it('tells a module page from a redirect to the tour search', () => {
    expect(isModulePage(page('search_hotel'), 'hotels')).toBe(true)
    expect(isModulePage(page('search_tour'), 'hotels')).toBe(false)
    expect(isModulePage(page('search_excursion'), 'excursions')).toBe(true)
    expect(isModulePage(page('search_hotel'), 'excursions')).toBe(false)
  })

  it('reads countries and departures with our slugs', () => {
    const form = parseModuleForm(page('search_excursion', '<select name="TOWNFROMINC"><option value="99">Наземное обслуживание</option><option value="1">Ташкент</option></select>'
      + '<select name="STATEINC"><option value="42">Италия</option><option value="14">Узбекистан</option></select>'))

    expect(form.countries).toEqual([{ slug: 'italy', label: 'Италия', code: '42' }, { slug: 'uzbekistan', label: 'Узбекистан', code: '14' }])
    expect(form.departures.map(item => item.slug)).toEqual(['nazemnoe-obsluzhivanie', 'tashkent'])
  })

  it('asks in a currency the module offers', () => {
    const usdEur = [{ value: '2', label: 'USD' }, { value: '3', label: 'EUR' }]

    expect(pickCurrency(usdEur, '3')).toBe('3')
    expect(pickCurrency([{ value: '3', label: 'EUR' }], '2')).toBe('3')
    expect(pickCurrency([{ value: '9', label: 'KZT' }, { value: '2', label: 'USD' }], '10')).toBe('2')
    expect(pickCurrency([], '2')).toBe('2')
  })

  it('picks the traveller’s city, then land-only, then the first departure', () => {
    const departures = [
      { slug: 'nazemnoe-obsluzhivanie', label: 'Наземное обслуживание', code: '99' },
      { slug: 'tashkent', label: 'Ташкент', code: '1' },
    ]

    expect(pickDeparture(departures, 'tashkent')).toEqual({ code: '1', landOnly: false })
    expect(pickDeparture(departures, 'samarkand')).toEqual({ code: '99', landOnly: true })
    expect(pickDeparture([{ slug: 'tashkent', label: 'Ташкент', code: '1' }], 'fergana')).toEqual({ code: '1', landOnly: false })
    expect(pickDeparture([], 'tashkent')).toBeNull()
  })

  it('spots transfer-only rows among hotels', () => {
    expect(isTransferOnly('ONLY TRANSFER TR S')).toBe(true)
    expect(isTransferOnly('Трансфер аэропорт — отель')).toBe(true)
    expect(isTransferOnly('KEMER STAR HOTEL 3*')).toBe(false)
  })

  it('spots land-only departures', () => {
    expect(isLandOnly('Наземное обслуживание')).toBe(true)
    expect(isLandOnly('Без перелёта')).toBe(true)
    expect(isLandOnly('Ташкент')).toBe(false)
  })
})
