import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CacheService } from '~/shared/cache/cache.service'
import { IokaEsimProvider, iokaPlan } from './ioka.provider'
import { FixtureIokaSource } from './ioka.source'
import type { IIokaSource } from './ioka.source'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const fixtures = new FixtureIokaSource(join(__dirname, 'fixtures', 'ioka'))

describe('ioka eSIM catalog', () => {
  it('lists only countries that have tariffs, priced in their own sums', async () => {
    const provider = new IokaEsimProvider(fixtures)

    expect(await provider.countries()).toEqual([{ code: 'TR', plans: 7, fromUsd: 1.61, fromUzs: 19550 }])
  })

  it('keeps volume, days, networks and the retail price of a tariff', async () => {
    const plans = await new IokaEsimProvider(fixtures).plans('TR')
    const ten = plans.find(plan => plan.id === 'globi:tr-010gb-030d')

    expect(plans).toHaveLength(7)
    expect(ten).toEqual({
      id: 'globi:tr-010gb-030d',
      country: 'TR',
      title: '10GB - 30 days',
      dataMb: 10240,
      days: 30,
      wholesaleUsd: 8.51,
      retailUzs: 103040,
      networks: ['Turk Telekom (Avea)'],
    })
  })

  it('treats an «Unlim» tariff as unlimited', async () => {
    const plan = await new IokaEsimProvider(fixtures).plan('globi:tr-unlim-010d')

    expect(plan?.dataMb).toBeNull()
    expect(plan?.days).toBe(10)
  })

  it('drops tariffs without a price or a period', () => {
    expect(iokaPlan({ id: 'x:tr-1', name: '1GB', validity: 0, price_usd: '2' }, 'tr')).toBeNull()
    expect(iokaPlan({ id: 'x:tr-1', name: '1GB', validity: 7, price_usd: '0' }, 'tr')).toBeNull()
  })

  it('never issues an eSIM itself', async () => {
    const provider = new IokaEsimProvider(fixtures)

    expect(provider.canIssue).toBe(false)
    await expect(provider.issue()).rejects.toThrow('partner cabinet')
  })

  it('asks ioka once and serves the rest from the cache', async () => {
    let calls = 0
    const counting: IIokaSource = { get: async (path, query) => { calls++; return fixtures.get(path, query) } }
    const provider = new IokaEsimProvider(counting, new CacheService())

    await provider.plans('tr')
    await provider.plans('tr')

    expect(calls).toBe(1)
  })
})
