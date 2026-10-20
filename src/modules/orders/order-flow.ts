import type { LeadTrigger } from '~/modules/leads/lead.flow'
import { OrderStatus, SETTLED_STATUSES } from './order.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const CLOCK_STATUSES: OrderStatus[] = [OrderStatus.Issued, OrderStatus.Travelling]

export interface IClockOrder {
  status: string
  checkIn: string | null
  returnDate: string | null
  nights: number
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const tashkentDay = (now: Date): string =>
  new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10)

const addDays = (day: string, days: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)

export function returnDayOf(order: IClockOrder): string | null {
  if (order.returnDate && ISO_DATE.test(order.returnDate)) return order.returnDate

  if (!order.checkIn || !ISO_DATE.test(order.checkIn)) return null

  return addDays(order.checkIn, Math.max(0, order.nights || 0))
}

export function clockPath(order: IClockOrder, today: string): OrderStatus[] {
  const back = returnDayOf(order)
  const home = back !== null && back < today

  if (order.status === OrderStatus.Issued) {
    if (!order.checkIn || !ISO_DATE.test(order.checkIn) || order.checkIn > today) return []

    return home ? [OrderStatus.Travelling, OrderStatus.Completed] : [OrderStatus.Travelling]
  }

  if (order.status === OrderStatus.Travelling && home) return [OrderStatus.Completed]

  return []
}

export function leadTriggerOf(status: OrderStatus): LeadTrigger | null {
  if (status === OrderStatus.Requested) return 'taken'
  if (status === OrderStatus.Confirmed || SETTLED_STATUSES.includes(status)) return 'ordered'
  if (status === OrderStatus.Cancelled) return 'reopened'

  return null
}
