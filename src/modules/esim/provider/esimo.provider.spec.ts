import { describe, expect, it } from 'vitest'
import { EsimoProvider, esimoCatalog, esimoPlan } from './esimo.provider'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const packages = [
  { id: '3GB_30D_TR', planName: 'Türkiye 3GB', coverage: 'TR', url: 'https://www.esimo.io/product/turkey-only-data', dataGBAmount: 3, isUnlimited: false, duration: 30, price: 6.9, currency: 'USD' },
  { id: '1GB_7D_TR', planName: 'Türkiye 1GB', coverage: 'TR', url: 'https://www.esimo.io/product/turkey-only-data', dataGBAmount: 1, isUnlimited: false, duration: 7, price: 3.9, currency: 'USD' },
  { id: 'UL_7D_TR', planName: 'Türkiye Unlimited 7 days', coverage: 'TR', url: 'https://www.esimo.io/product/turkey-only-data', dataGBAmount: -1, isUnlimited: true, duration: 7, price: 26.9, currency: 'USD' },
  { id: 'UL_8D_TR', planName: 'Türkiye Unlimited 8 days', coverage: 'TR', url: 'https://www.esimo.io/product/turkey-only-data', dataGBAmount: -1, isUnlimited: true, duration: 8, price: 29.6, currency: 'USD' },
  { id: '1GB_7D_RAF', planName: 'Africa 1GB', coverage: 'EG;KE;MA', url: 'https://www.esimo.io/product/africa', dataGBAmount: 1, isUnlimited: false, duration: 7, price: 9.8, currency: 'USD' },
  { id: '1GB_7D_EG', planName: 'Egypt 1GB', coverage: 'EG', url: 'https://www.esimo.io/product/egypt-only-data', dataGBAmount: 1, isUnlimited: false, duration: 7, price: 3.9, currency: 'EUR' },
]

describe('eSIMo catalog', () => {
  it('keeps single-country USD tariffs and turns unlimited ones into null volume', () => {
    expect(esimoPlan(packages[2]!)).toEqual({
      id: 'UL_7D_TR',
      country: 'TR',
      title: 'Türkiye Unlimited 7 days',
      dataMb: null,
      days: 7,
      wholesaleUsd: 26.9,
      networks: [],
    })
    expect(esimoPlan(packages[0]!)?.dataMb).toBe(3072)
  })

  it('drops regions, other currencies and the unlimited days we do not show', () => {
    expect(esimoPlan(packages[3]!)).toBeNull()
    expect(esimoPlan(packages[4]!)).toBeNull()
    expect(esimoPlan(packages[5]!)).toBeNull()
  })

  it('groups tariffs by country, cheapest first', () => {
    const catalog = esimoCatalog(packages)

    expect(Object.keys(catalog)).toEqual(['TR'])
    expect(catalog.TR!.map(plan => plan.id)).toEqual(['1GB_7D_TR', '3GB_30D_TR', 'UL_7D_TR'])
    expect(esimoCatalog({ error: 'nope' })).toEqual({})
  })

  it('serves countries and finds a tariff by id', async () => {
    const provider = new EsimoProvider(async () => packages)

    expect(await provider.countries()).toEqual([{ code: 'TR', plans: 3, fromUsd: 3.9 }])
    expect((await provider.plan('3GB_30D_TR'))?.days).toBe(30)
    expect(await provider.plan('3GB_30D_XX')).toBeNull()
    expect(provider.canIssue).toBe(false)
  })

  it('loads the list once and survives a failing source', async () => {
    let calls = 0
    const provider = new EsimoProvider(async () => {
      calls++

      return packages
    })

    await provider.countries()
    await provider.plans('tr')

    expect(calls).toBe(1)
    expect(await new EsimoProvider(async () => { throw new Error('down') }).countries()).toEqual([])
  })
})
