import { describe, expect, it } from 'vitest'
import { CURRENCY_CODES } from './dictionary.seed'
import { SupplierDictionary, parseCrossRates } from './supplier-dictionary'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const page = (rates: string, currencies: string): string => `
  <select name="TOWNFROMINC"><option value="1853">Ташкент</option></select>
  <select name="CURRENCY">${currencies}</select>
  <script>samo.CROSS_RATES = ${rates};</script>
`

const MALVA = '{"2":{"Inc":2,"Name":"USD","Date":"20.10.2026","3":0.88790579,"4":12129.033},"3":{"Inc":3,"Name":"EUR","Date":"20.10.2026","2":1.12624561,"4":13660.2702},"4":{"Inc":4,"Name":"UZS","Date":"20.10.2026","2":8.245e-5}}'

const KOMPAS = '{"2":{"Inc":2,"Name":"USD","Date":"20.10.2026","10":12170},"3":{"Inc":3,"Name":"EUR","Date":"20.10.2026","10":13850},"10":{"Inc":10,"Name":"UZS","Date":"20.10.2026"}}'

describe('operator cross rates', () => {
  it('learns currency codes from the rate table itself', () => {
    const { rates, codes } = parseCrossRates(page(MALVA, ''))

    expect(codes.get('UZS')).toBe('4')
    expect(rates.get('2')?.get('4')).toBe(12129.033)
  })

  it('finds the sum rate when the currency list has no UZS option', async () => {
    const dictionary = new SupplierDictionary('malva', async () => page(MALVA, '<option value="2">USD</option><option value="3">EUR</option>'))

    expect(await dictionary.uzsRates(CURRENCY_CODES)).toEqual({ USD: 12129.033, EUR: 13660.2702 })
  })

  it('still works for operators on the usual codes', async () => {
    const dictionary = new SupplierDictionary('kompastour', async () => page(KOMPAS, '<option value="2">USD</option><option value="10">UZS</option>'))

    expect(await dictionary.uzsRates(CURRENCY_CODES)).toEqual({ USD: 12170, EUR: 13850 })
  })
})
