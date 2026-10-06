import { LEAD_PREFIX, ORDER_PREFIX, reference } from '~/shared/helpers/reference'
import { passportProblem } from '~/modules/orders/orders.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IAnalyticsLead {
  id: string
  number: number
  createdAt: Date
  status: string
  channel: string
  firstResponseAt: Date | null
  managerId: string | null
  rejectReason: string
  name: string
}

export interface IAnalyticsOrder {
  id: string
  number: number
  leadId: string
  status: string
  createdAt: Date
  updatedAt: Date
  country: string
  supplierName: string
  hotelName: string
  hotelStars: number | null
  travellerName: string
  priceAmount: number | null
  priceCurrency: string
  checkIn: string | null
  returnDate: string | null
  nights: number
  passportExpiresAt: string | null
  managerId: string | null
  cancelReason: string
}

export interface IAnalyticsEvent {
  orderId: string
  toStatus: string
  createdAt: Date
}

export interface IAnalyticsInput {
  from: string
  to: string
  now: Date
  leads: IAnalyticsLead[]
  orders: IAnalyticsOrder[]
  events: IAnalyticsEvent[]
  rates: Record<string, number>
  managers: Map<string, string>
}

interface IRange {
  start: Date
  end: Date
}

export const RESPONSE_SLA_MINUTES = 15
export const STUCK_REQUEST_HOURS = 48
export const DEPARTURE_WINDOW_DAYS = 7
export const TASHKENT_OFFSET = '+05:00'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
const SETTLED = ['paid', 'issued', 'travelling', 'completed']
const OPEN = ['draft', 'requested', 'confirmed']

export const cleanHotelName = (name: string): string =>
  name.replace(/\s*\d\s*\*+\s*\+?\s*$/, '').replace(/\s+/g, ' ').trim()

const startOf = (day: string): Date => new Date(`${day}T00:00:00${TASHKENT_OFFSET}`)

const dayOf = (at: Date): string => new Date(at.getTime() + 5 * 60 * MINUTE).toISOString().slice(0, 10)

const within = (at: Date | null, range: IRange): boolean =>
  Boolean(at) && at!.getTime() >= range.start.getTime() && at!.getTime() < range.end.getTime()

const median = (values: number[]): number | null => {
  if (!values.length) return null

  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  return sorted.length % 2 ? sorted[middle]! : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
}

const ratio = (part: number, whole: number): number | null => (whole ? part / whole : null)

const round = (value: number): number => Math.round(value * 100) / 100

export function toUsd(amount: number | null, currency: string, rates: Record<string, number>): number | null {
  if (amount === null || !Number.isFinite(amount)) return null

  const code = (currency || 'USD').toUpperCase()

  if (code === 'USD') return amount

  const usd = rates.USD

  if (!usd) return null
  if (code === 'UZS') return amount / usd

  const rate = rates[code]

  return rate ? (amount * rate) / usd : null
}

function rangesFor(from: string, to: string): { current: IRange, previous: IRange, days: number } {
  const start = startOf(from)
  const end = new Date(startOf(to).getTime() + DAY)
  const length = end.getTime() - start.getTime()

  return {
    current: { start, end },
    previous: { start: new Date(start.getTime() - length), end: start },
    days: Math.round(length / DAY),
  }
}

function tally<T>(items: T[], keyOf: (item: T) => string, valueOf: (item: T) => number) {
  const groups = new Map<string, { key: string, count: number, value: number }>()

  for (const item of items) {
    const key = keyOf(item)
    const group = groups.get(key) ?? { key, count: 0, value: 0 }

    group.count += 1
    group.value += valueOf(item)
    groups.set(key, group)
  }

  return [...groups.values()]
}

export function buildAnalytics(input: IAnalyticsInput) {
  const { current, previous, days } = rangesFor(input.from, input.to)
  const nowMs = input.now.getTime()

  const eventsByOrder = new Map<string, IAnalyticsEvent[]>()
  for (const event of input.events) {
    const list = eventsByOrder.get(event.orderId) ?? []
    list.push(event)
    eventsByOrder.set(event.orderId, list)
  }

  const firstEvent = (orderId: string, status: string): Date | null => {
    const times = (eventsByOrder.get(orderId) ?? []).filter(e => e.toStatus === status).map(e => e.createdAt.getTime())

    return times.length ? new Date(Math.min(...times)) : null
  }

  const lastEvent = (orderId: string, status: string): Date | null => {
    const times = (eventsByOrder.get(orderId) ?? []).filter(e => e.toStatus === status).map(e => e.createdAt.getTime())

    return times.length ? new Date(Math.max(...times)) : null
  }

  const paidAt = (order: IAnalyticsOrder): Date | null =>
    order.status === 'cancelled'
      ? null
      : firstEvent(order.id, 'paid') ?? (SETTLED.includes(order.status) ? order.updatedAt : null)

  const usdOf = (order: IAnalyticsOrder): number => toUsd(order.priceAmount, order.priceCurrency, input.rates) ?? 0

  const ordersByLead = new Map<string, IAnalyticsOrder[]>()
  for (const order of input.orders) {
    const list = ordersByLead.get(order.leadId) ?? []
    list.push(order)
    ordersByLead.set(order.leadId, list)
  }

  const leadPaid = (lead: IAnalyticsLead) => (ordersByLead.get(lead.id) ?? []).some(order => paidAt(order))
  const leadDeal = (lead: IAnalyticsLead) =>
    lead.status === 'won' || (ordersByLead.get(lead.id) ?? []).some(order => order.status !== 'cancelled')
  const leadCompleted = (lead: IAnalyticsLead) => (ordersByLead.get(lead.id) ?? []).some(order => order.status === 'completed')
  const answered = (lead: IAnalyticsLead) => Boolean(lead.firstResponseAt) || lead.status !== 'new'

  const responseMinutes = (lead: IAnalyticsLead): number | null =>
    lead.firstResponseAt ? Math.max(0, Math.round((lead.firstResponseAt.getTime() - lead.createdAt.getTime()) / MINUTE)) : null

  const kpisFor = (range: IRange) => {
    const leads = input.leads.filter(lead => within(lead.createdAt, range))
    const paid = input.orders.filter(order => within(paidAt(order), range))
    const revenue = paid.reduce((sum, order) => sum + usdOf(order), 0)
    const minutes = leads.map(responseMinutes).filter((value): value is number => value !== null)
    const measurable = leads.filter(lead =>
      lead.firstResponseAt || (nowMs - lead.createdAt.getTime()) / MINUTE > RESPONSE_SLA_MINUTES)

    return {
      leads: leads.length,
      paidOrders: paid.length,
      revenueUsd: round(revenue),
      averageOrderUsd: paid.length ? round(revenue / paid.length) : null,
      conversion: ratio(leads.filter(leadPaid).length, leads.length),
      responseMedianMinutes: median(minutes),
      responseWithinSla: ratio(minutes.filter(value => value <= RESPONSE_SLA_MINUTES).length, measurable.length),
    }
  }

  const periodLeads = input.leads.filter(lead => within(lead.createdAt, current))
  const periodPaid = input.orders.filter(order => within(paidAt(order), current))

  const weekly = days > 92
  const bucketOf = (at: Date): string => {
    const day = dayOf(at)

    if (!weekly) return day

    const date = startOf(day)
    const weekday = (new Date(date.getTime() + 5 * 60 * MINUTE).getUTCDay() + 6) % 7

    return dayOf(new Date(date.getTime() - weekday * DAY))
  }

  const buckets = new Map<string, { date: string, leads: number, paid: number, revenueUsd: number }>()
  for (let at = current.start.getTime(); at < current.end.getTime(); at += weekly ? 7 * DAY : DAY) {
    const key = bucketOf(new Date(at))
    if (!buckets.has(key)) buckets.set(key, { date: key, leads: 0, paid: 0, revenueUsd: 0 })
  }
  for (const lead of periodLeads) {
    const bucket = buckets.get(bucketOf(lead.createdAt))
    if (bucket) bucket.leads += 1
  }
  for (const order of periodPaid) {
    const bucket = buckets.get(bucketOf(paidAt(order)!))
    if (bucket) {
      bucket.paid += 1
      bucket.revenueUsd = round(bucket.revenueUsd + usdOf(order))
    }
  }

  const funnel = [
    { key: 'leads', count: periodLeads.length },
    { key: 'answered', count: periodLeads.filter(answered).length },
    { key: 'deal', count: periodLeads.filter(leadDeal).length },
    { key: 'paid', count: periodLeads.filter(leadPaid).length },
    { key: 'completed', count: periodLeads.filter(leadCompleted).length },
  ]

  const rejections = tally(
    periodLeads.filter(lead => lead.status === 'rejected'),
    lead => lead.rejectReason.trim(),
    () => 0,
  ).sort((a, b) => b.count - a.count).slice(0, 6).map(({ key, count }) => ({ reason: key, count }))

  const unanswered = input.leads
    .filter(lead => lead.status === 'new' && !lead.firstResponseAt)
    .map(lead => ({ lead, minutes: Math.round((nowMs - lead.createdAt.getTime()) / MINUTE) }))
    .filter(item => item.minutes > RESPONSE_SLA_MINUTES)
    .sort((a, b) => b.minutes - a.minutes)

  const stuck = input.orders
    .filter(order => order.status === 'requested')
    .map(order => ({ order, hours: Math.round((nowMs - (lastEvent(order.id, 'requested') ?? order.updatedAt).getTime()) / (60 * MINUTE)) }))
    .filter(item => item.hours > STUCK_REQUEST_HOURS)
    .sort((a, b) => b.hours - a.hours)

  const today = dayOf(input.now)
  const horizon = dayOf(new Date(nowMs + DEPARTURE_WINDOW_DAYS * DAY))

  const departures = input.orders
    .filter(order => order.checkIn && order.checkIn >= today && order.checkIn <= horizon
      && order.status !== 'cancelled' && order.status !== 'completed')
    .map((order) => {
      const problems: string[] = []

      if (OPEN.includes(order.status)) problems.push('unpaid')

      if (!order.passportExpiresAt) problems.push('passport_missing')
      else {
        const passport = passportProblem({
          returnDate: order.returnDate,
          checkIn: order.checkIn,
          nights: order.nights,
          passportExpiresAt: order.passportExpiresAt,
        })

        if (passport) problems.push(`passport_${passport}`)
      }

      return { order, problems }
    })
    .filter(item => item.problems.length)
    .sort((a, b) => a.order.checkIn!.localeCompare(b.order.checkIn!))

  const cancellations = input.orders
    .map(order => ({ order, at: order.status === 'cancelled' ? lastEvent(order.id, 'cancelled') ?? order.updatedAt : null }))
    .filter(item => within(item.at, current))
    .sort((a, b) => b.at!.getTime() - a.at!.getTime())

  const orderRef = (order: IAnalyticsOrder) => reference(ORDER_PREFIX, order.number, order.createdAt)

  const mix = (keyOf: (order: IAnalyticsOrder) => string, limit = 8) =>
    tally(periodPaid, keyOf, usdOf)
      .sort((a, b) => b.value - a.value || b.count - a.count)
      .slice(0, limit)
      .map(({ key, count, value }) => ({ key, orders: count, revenueUsd: round(value) }))

  const channels = tally(periodLeads, lead => lead.channel || 'site', lead => (leadPaid(lead) ? 1 : 0))
    .sort((a, b) => b.count - a.count)
    .map(({ key, count, value }) => ({ channel: key, leads: count, paid: value, conversion: ratio(value, count) }))

  const managerIds = new Set<string>([
    ...periodLeads.map(lead => lead.managerId ?? ''),
    ...periodPaid.map(order => order.managerId ?? ''),
  ])

  const managers = [...managerIds].map((id) => {
    const leads = periodLeads.filter(lead => (lead.managerId ?? '') === id)
    const paid = periodPaid.filter(order => (order.managerId ?? '') === id)
    const minutes = leads.map(responseMinutes).filter((value): value is number => value !== null)

    return {
      id: id || null,
      name: id ? input.managers.get(id) ?? '' : '',
      leads: leads.length,
      statuses: {
        new: leads.filter(lead => lead.status === 'new').length,
        inProgress: leads.filter(lead => lead.status === 'in_progress').length,
        quoteSent: leads.filter(lead => lead.status === 'quote_sent').length,
        won: leads.filter(lead => lead.status === 'won').length,
        rejected: leads.filter(lead => lead.status === 'rejected').length,
      },
      responseMedianMinutes: median(minutes),
      conversion: ratio(leads.filter(leadPaid).length, leads.length),
      paidOrders: paid.length,
      revenueUsd: round(paid.reduce((sum, order) => sum + usdOf(order), 0)),
    }
  }).sort((a, b) => b.revenueUsd - a.revenueUsd || b.leads - a.leads)

  return {
    period: {
      from: input.from,
      to: input.to,
      days,
      previous: { from: dayOf(previous.start), to: dayOf(new Date(previous.end.getTime() - DAY)) },
      bucket: weekly ? 'week' : 'day',
    },
    usdRate: input.rates.USD ?? null,
    kpis: { current: kpisFor(current), previous: kpisFor(previous) },
    trend: [...buckets.values()],
    funnel,
    rejections,
    attention: {
      unanswered: {
        total: unanswered.length,
        items: unanswered.slice(0, 8).map(({ lead, minutes }) => ({
          id: lead.id, ref: reference(LEAD_PREFIX, lead.number, lead.createdAt), name: lead.name, minutes,
        })),
      },
      stuckRequests: {
        total: stuck.length,
        items: stuck.slice(0, 8).map(({ order, hours }) => ({
          id: order.id, ref: orderRef(order), hotel: order.hotelName, hours,
        })),
      },
      departures: {
        total: departures.length,
        items: departures.slice(0, 8).map(({ order, problems }) => ({
          id: order.id, ref: orderRef(order), traveller: order.travellerName, hotel: order.hotelName, checkIn: order.checkIn, problems,
        })),
      },
      cancellations: {
        total: cancellations.length,
        items: cancellations.slice(0, 5).map(({ order, at }) => ({
          id: order.id, ref: orderRef(order), hotel: order.hotelName, reason: order.cancelReason, at: at!.toISOString(),
        })),
      },
    },
    mix: {
      destinations: mix(order => order.country),
      operators: mix(order => order.supplierName),
      stars: mix(order => (order.hotelStars ? String(order.hotelStars) : ''), 6),
      hotels: mix(order => cleanHotelName(order.hotelName)),
      channels,
    },
    managers,
  }
}

export type AnalyticsReport = ReturnType<typeof buildAnalytics>
