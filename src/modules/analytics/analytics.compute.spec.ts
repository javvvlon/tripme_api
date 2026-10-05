import { describe, expect, it } from 'vitest'
import { buildAnalytics, toUsd } from './analytics.compute'
import type { IAnalyticsEvent, IAnalyticsInput, IAnalyticsLead, IAnalyticsOrder } from './analytics.compute'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const at = (iso: string) => new Date(iso)

const lead = (over: Partial<IAnalyticsLead>): IAnalyticsLead => ({
  id: 'l', number: 1, createdAt: at('2026-10-02T06:00:00Z'), status: 'new', channel: 'site',
  firstResponseAt: null, managerId: 'm1', rejectReason: '', name: 'Client', ...over,
})

const order = (over: Partial<IAnalyticsOrder>): IAnalyticsOrder => ({
  id: 'o', number: 1, leadId: 'l', status: 'draft', createdAt: at('2026-10-02T07:00:00Z'), updatedAt: at('2026-10-02T07:00:00Z'),
  country: 'egypt', supplierName: 'FUN&SUN Asia', hotelName: 'Rixos', hotelStars: 5, travellerName: 'CLIENT',
  priceAmount: 1000, priceCurrency: 'USD', checkIn: '2026-11-10', returnDate: null, nights: 7,
  passportExpiresAt: '2030-01-01', managerId: 'm1', cancelReason: '', ...over,
})

const paidEvent = (orderId: string, when: string): IAnalyticsEvent => ({ orderId, toStatus: 'paid', createdAt: at(when) })

const input = (over: Partial<IAnalyticsInput>): IAnalyticsInput => ({
  from: '2026-10-01', to: '2026-10-07', now: at('2026-10-07T12:00:00Z'),
  leads: [], orders: [], events: [], rates: { USD: 12000, EUR: 13200 }, managers: new Map([['m1', 'Dilshod K']]), ...over,
})

describe('analytics', () => {
  it('converts prices to dollars through the central bank rates', () => {
    expect(toUsd(1000, 'USD', {})).toBe(1000)
    expect(toUsd(12_000_000, 'UZS', { USD: 12000 })).toBe(1000)
    expect(toUsd(1000, 'EUR', { USD: 12000, EUR: 13200 })).toBeCloseTo(1100)
    expect(toUsd(1000, 'EUR', {})).toBeNull()
  })

  it('counts leads, paid orders, revenue and conversion for the period and the one before', () => {
    const report = buildAnalytics(input({
      leads: [
        lead({ id: 'a', firstResponseAt: at('2026-10-02T06:05:00Z'), status: 'won' }),
        lead({ id: 'b', firstResponseAt: at('2026-10-02T06:40:00Z'), status: 'in_progress' }),
        lead({ id: 'c', createdAt: at('2026-09-28T06:00:00Z') }),
      ],
      orders: [
        order({ id: 'oa', leadId: 'a', status: 'paid', priceAmount: 1000, priceCurrency: 'EUR' }),
        order({ id: 'oc', leadId: 'c', status: 'completed', priceAmount: 500 }),
      ],
      events: [paidEvent('oa', '2026-10-03T06:00:00Z'), paidEvent('oc', '2026-09-29T06:00:00Z')],
    }))

    expect(report.kpis.current).toMatchObject({
      leads: 2, paidOrders: 1, revenueUsd: 1100, averageOrderUsd: 1100, conversion: 0.5,
      responseMedianMinutes: 23, responseWithinSla: 0.5,
    })
    expect(report.kpis.previous).toMatchObject({ leads: 1, paidOrders: 1, revenueUsd: 500 })
    expect(report.period.previous).toEqual({ from: '2026-09-24', to: '2026-09-30' })
  })

  it('walks the funnel from lead to completed trip', () => {
    const report = buildAnalytics(input({
      leads: [
        lead({ id: 'a', status: 'won', firstResponseAt: at('2026-10-02T06:05:00Z') }),
        lead({ id: 'b', status: 'in_progress', firstResponseAt: at('2026-10-02T06:05:00Z') }),
        lead({ id: 'c', status: 'rejected', rejectReason: 'Дорого', firstResponseAt: at('2026-10-02T06:05:00Z') }),
        lead({ id: 'd' }),
      ],
      orders: [order({ id: 'oa', leadId: 'a', status: 'completed' })],
      events: [paidEvent('oa', '2026-10-03T06:00:00Z')],
    }))

    expect(report.funnel.map(step => step.count)).toEqual([4, 3, 1, 1, 1])
    expect(report.rejections).toEqual([{ reason: 'Дорого', count: 1 }])
  })

  it('lists what needs attention now', () => {
    const report = buildAnalytics(input({
      now: at('2026-10-07T12:00:00Z'),
      leads: [lead({ id: 'late', createdAt: at('2026-10-07T11:00:00Z'), number: 12 }), lead({ id: 'fresh', createdAt: at('2026-10-07T11:55:00Z') })],
      orders: [
        order({ id: 'stuck', status: 'requested', updatedAt: at('2026-10-04T12:00:00Z') }),
        order({ id: 'soon', status: 'confirmed', checkIn: '2026-10-10', passportExpiresAt: '2027-01-01' }),
        order({ id: 'fine', status: 'paid', checkIn: '2026-10-11' }),
        order({ id: 'gone', status: 'cancelled', cancelReason: 'Передумал', updatedAt: at('2026-10-05T12:00:00Z') }),
      ],
      events: [{ orderId: 'gone', toStatus: 'cancelled', createdAt: at('2026-10-05T12:00:00Z') }],
    }))

    expect(report.attention.unanswered.items.map(item => item.ref)).toEqual(['LD-2026-0012'])
    expect(report.attention.stuckRequests.items.map(item => item.id)).toEqual(['stuck'])
    expect(report.attention.departures.items).toEqual([expect.objectContaining({ id: 'soon', problems: ['unpaid', 'passport_short'] })])
    expect(report.attention.cancellations.items).toEqual([expect.objectContaining({ id: 'gone', reason: 'Передумал' })])
  })

  it('buckets the trend by day, and by week past three months', () => {
    expect(buildAnalytics(input({})).trend).toHaveLength(7)
    expect(buildAnalytics(input({ from: '2026-01-01', to: '2026-10-07' })).period.bucket).toBe('week')
  })

  it('groups a hotel whether or not its name carries the stars', () => {
    const report = buildAnalytics(input({
      orders: [
        order({ id: 'x', status: 'paid', hotelName: 'Rixos Sharm El Sheikh 5*' }),
        order({ id: 'y', status: 'paid', hotelName: 'Rixos Sharm El Sheikh' }),
      ],
      events: [paidEvent('x', '2026-10-03T06:00:00Z'), paidEvent('y', '2026-10-04T06:00:00Z')],
    }))

    expect(report.mix.hotels).toEqual([{ key: 'Rixos Sharm El Sheikh', orders: 2, revenueUsd: 2000 }])
  })

  it('does not count a cancelled order as revenue', () => {
    const report = buildAnalytics(input({
      leads: [lead({ id: 'a', status: 'won' })],
      orders: [order({ id: 'oa', leadId: 'a', status: 'cancelled' })],
      events: [paidEvent('oa', '2026-10-03T06:00:00Z')],
    }))

    expect(report.kpis.current.revenueUsd).toBe(0)
    expect(report.kpis.current.conversion).toBe(0)
  })
})
