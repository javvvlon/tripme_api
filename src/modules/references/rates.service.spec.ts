import { afterEach, describe, expect, it, vi } from 'vitest'
import { marketRates, RatesService } from './rates.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const market = {
  result: 'success',
  time_last_update_unix: 1793145751,
  rates: { USD: 1, UZS: 11893.79, EUR: 0.9, RUB: 80 },
}

const cbuRows = [
  { Ccy: 'USD', Rate: '11861.96', Nominal: '1', Date: '28.10.2026' },
  { Ccy: 'EUR', Rate: '13300.10', Nominal: '1', Date: '28.10.2026' },
]

const answer = (body: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('market rates', () => {
  it('turns a per-dollar table into sums per currency', () => {
    const rates = marketRates(market)

    expect(rates.source).toBe('market')
    expect(rates.rates.USD).toBe(11893.79)
    expect(rates.rates.EUR).toBe(13215.32)
    expect(rates.rates.RUB).toBe(148.67)
    expect(rates.date).toBe('2026-10-28')
  })

  it('gives nothing when the answer is not usable', () => {
    expect(marketRates({ result: 'error' }).rates).toEqual({})
    expect(marketRates({ result: 'success', rates: { USD: 1 } }).rates).toEqual({})
  })
})

describe('rates service', () => {
  it('stops waiting on the central bank after a failure and shows the market rate instead', async () => {
    const fetcher = vi.fn((url: string) => (url.includes('cbu.uz') ? Promise.reject(new Error('timeout')) : answer(market)))

    vi.stubGlobal('fetch', fetcher)

    const service = new RatesService()

    expect((await service.current()).rates).toEqual({})
    expect((await service.display()).source).toBe('market')
    expect(await service.on('2026-10-20')).toBeNull()
    await service.current()

    expect(fetcher.mock.calls.filter(([url]) => String(url).includes('cbu.uz'))).toHaveLength(1)
  })

  it('keeps using the central bank rate when it answers', async () => {
    vi.stubGlobal('fetch', vi.fn(() => answer(cbuRows)))

    const service = new RatesService()
    const shown = await service.display()

    expect(shown.source).toBe('cbu')
    expect(shown.rates.USD).toBe(11861.96)
    expect(shown.date).toBe('2026-10-28')
  })
})
