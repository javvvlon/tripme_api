import { describe, expect, it } from 'vitest'
import { LEAD_TRANSITIONS, LeadStatus } from '~/modules/leads/lead.entity'
import { ORDER_STATUSES, ORDER_TRANSITIONS, OrderStatus, SETTLED_STATUSES } from './order.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const reachable = (from: OrderStatus): Set<OrderStatus> => {
  const seen = new Set<OrderStatus>()
  const queue = [from]

  while (queue.length) {
    const current = queue.shift()!

    for (const next of ORDER_TRANSITIONS[current]) {
      if (seen.has(next)) continue

      seen.add(next)
      queue.push(next)
    }
  }

  return seen
}

describe('order status', () => {
  it('walks the whole booking in order', () => {
    const path = [
      OrderStatus.Draft,
      OrderStatus.Requested,
      OrderStatus.Confirmed,
      OrderStatus.Issued,
      OrderStatus.Travelling,
      OrderStatus.Completed,
    ]

    for (const [index, status] of path.entries()) {
      const next = path[index + 1]

      if (next) expect(ORDER_TRANSITIONS[status]).toContain(next)
    }
  })

  it('refuses to skip a step', () => {
    expect(ORDER_TRANSITIONS[OrderStatus.Draft]).not.toContain(OrderStatus.Confirmed)
    expect(ORDER_TRANSITIONS[OrderStatus.Requested]).not.toContain(OrderStatus.Issued)
    expect(ORDER_TRANSITIONS[OrderStatus.Confirmed]).not.toContain(OrderStatus.Completed)
  })

  it('lets a mistake be corrected before money moves', () => {
    expect(ORDER_TRANSITIONS[OrderStatus.Requested]).toContain(OrderStatus.Draft)
    expect(ORDER_TRANSITIONS[OrderStatus.Confirmed]).toContain(OrderStatus.Requested)
  })

  it('never walks payment backwards', () => {
    for (const settled of SETTLED_STATUSES) {
      for (const next of ORDER_TRANSITIONS[settled]) {
        expect(SETTLED_STATUSES.includes(next) || next === OrderStatus.Cancelled).toBe(true)
      }
    }

    expect(ORDER_TRANSITIONS[OrderStatus.Issued]).not.toContain(OrderStatus.Confirmed)
  })

  it('closes the finished order', () => {
    expect(ORDER_TRANSITIONS[OrderStatus.Completed]).toHaveLength(0)
  })

  it('closes a cancelled order, and a trip under way cannot be cancelled', () => {
    expect(ORDER_TRANSITIONS[OrderStatus.Cancelled]).toHaveLength(0)
    expect(ORDER_TRANSITIONS[OrderStatus.Travelling]).not.toContain(OrderStatus.Cancelled)
    expect(ORDER_TRANSITIONS[OrderStatus.Issued]).toContain(OrderStatus.Cancelled)
    expect(ORDER_TRANSITIONS[OrderStatus.Confirmed]).toContain(OrderStatus.Cancelled)
  })

  it('can reach the end from the beginning, and nothing is stranded', () => {
    expect(reachable(OrderStatus.Draft)).toContain(OrderStatus.Completed)

    for (const status of ORDER_STATUSES) {
      if (status === OrderStatus.Draft) continue

      const reachableFromStart = reachable(OrderStatus.Draft)

      expect(reachableFromStart.has(status)).toBe(true)
    }
  })
})

describe('lead status', () => {
  it('closes a rejected lead', () => {
    expect(LEAD_TRANSITIONS[LeadStatus.Rejected]).toHaveLength(0)
  })

  it('lets a won deal be reopened, since a booking can fall through', () => {
    expect(LEAD_TRANSITIONS[LeadStatus.Won]).toContain(LeadStatus.InProgress)
  })

  it('reaches every state from a new lead', () => {
    const seen = new Set<LeadStatus>([LeadStatus.New])
    const queue: LeadStatus[] = [LeadStatus.New]

    while (queue.length) {
      for (const next of LEAD_TRANSITIONS[queue.shift()!]) {
        if (seen.has(next)) continue

        seen.add(next)
        queue.push(next)
      }
    }

    expect(seen.size).toBe(Object.keys(LEAD_TRANSITIONS).length)
  })
})
