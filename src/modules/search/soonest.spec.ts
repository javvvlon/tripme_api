import { describe, expect, it, vi } from 'vitest'
import { SearchService } from './search.service'
import { SoonestCache, SOONEST_TTL_MS } from './soonest.cache'
import type { SearchCriteria } from './contracts/search'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const criteria = (over: Partial<SearchCriteria> = {}): SearchCriteria => ({
  from: 'tashkent',
  to: 'egypt',
  dateFrom: '2026-09-02',
  dateTo: '2026-09-02',
  nightsFrom: 7,
  nightsTo: 7,
  adults: 2,
  childrenAges: [],
  currency: 'USD',
  filters: { stars: [], meals: [], resorts: [], hotels: [], suppliers: [] },
  ...over,
})

/** A service whose fan-out is replaced by a fixed set of selling days. */
const serviceSelling = (days: string[]) => {
  const service = new SearchService([], { enabledSlugs: async () => [] } as never)
  const asked: Array<{ from: string, to: string }> = []

  vi.spyOn(service, 'fetchPage').mockImplementation(async (want) => {
    asked.push({ from: want.dateFrom, to: want.dateTo })

    const within = days.filter(day => day >= want.dateFrom && day <= want.dateTo)

    return {
      offers: within.map(day => ({ get: () => day })) as never,
      statuses: [],
      page: 1,
      hasMore: false,
      appliedLocally: [],
    }
  })

  return { service, asked }
}

describe('soonest departure', () => {
  it('takes the earliest day anyone is selling, not the first day asked for', async () => {
    const { service } = serviceSelling(['2026-09-08', '2026-09-05', '2026-09-06'])

    await expect(service.soonest(criteria())).resolves.toMatchObject({ date: '2026-09-05' })
  })

  it('answers a route selling today without widening', async () => {
    const { service, asked } = serviceSelling(['2026-09-02'])

    const answer = await service.soonest(criteria())

    expect(answer.date).toBe('2026-09-02')
    expect(answer.span).toBe(7)
    expect(asked).toHaveLength(1)
  })

  it('widens only while nothing comes back', async () => {
    const { service, asked } = serviceSelling(['2026-09-20'])

    const answer = await service.soonest(criteria())

    expect(answer.date).toBe('2026-09-20')
    expect(asked).toHaveLength(2)
    expect(asked[0]).toEqual({ from: '2026-09-02', to: '2026-09-08' })
    expect(asked[1]).toEqual({ from: '2026-09-02', to: '2026-09-22' })
  })

  it('says so when the route sells nothing at all', async () => {
    const { service, asked } = serviceSelling([])

    await expect(service.soonest(criteria())).resolves.toMatchObject({ date: null })
    expect(asked).toHaveLength(3)
  })

  it('never looks past the last window', async () => {
    const { service } = serviceSelling(['2027-01-01'])

    await expect(service.soonest(criteria())).resolves.toMatchObject({ date: null })
  })
})

describe('soonest cache', () => {
  it('asks once for everyone arriving at the same route', async () => {
    const cache = new SoonestCache()
    const resolve = vi.fn(async () => ({ date: '2026-09-05', span: 7, statuses: [] }))

    const answers = await Promise.all([
      cache.through(criteria(), resolve),
      cache.through(criteria(), resolve),
      cache.through(criteria(), resolve),
    ])

    expect(resolve).toHaveBeenCalledTimes(1)
    expect(answers.map(a => a.date)).toEqual(['2026-09-05', '2026-09-05', '2026-09-05'])
  })

  it('keeps routes apart', async () => {
    const cache = new SoonestCache()
    const resolve = vi.fn(async () => ({ date: '2026-09-05', span: 7, statuses: [] }))

    await cache.through(criteria(), resolve)
    await cache.through(criteria({ to: 'turkey' }), resolve)
    await cache.through(criteria({ adults: 3 }), resolve)

    expect(resolve).toHaveBeenCalledTimes(3)
  })

  it('asks again once the answer is stale', async () => {
    const cache = new SoonestCache()
    const resolve = vi.fn(async () => ({ date: '2026-09-05', span: 7, statuses: [] }))

    await cache.through(criteria(), resolve, 0)
    await cache.through(criteria(), resolve, SOONEST_TTL_MS - 1)
    await cache.through(criteria(), resolve, SOONEST_TTL_MS)

    expect(resolve).toHaveBeenCalledTimes(2)
  })

  it('does not remember a failure as an answer', async () => {
    const cache = new SoonestCache()
    let attempt = 0

    const resolve = vi.fn(async () => {
      attempt += 1

      if (attempt === 1) throw new Error('operators unreachable')

      return { date: '2026-09-05', span: 7, statuses: [] }
    })

    await expect(cache.through(criteria(), resolve)).rejects.toThrow('operators unreachable')
    await expect(cache.through(criteria(), resolve)).resolves.toMatchObject({ date: '2026-09-05' })
  })
})
