import { describe, expect, it, vi } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { OrdersService } from './orders.service'
import { OrderStatus } from './order.entity'
import { LeadsService } from '~/modules/leads/leads.service'
import { UserRole } from '~/modules/auth/contracts/auth'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const files = () => {
  const calls: string[] = []

  return {
    calls,
    filesOf: vi.fn(async (ids: string[]) => ids.map(id => `https://store/documents/${id}.pdf`)),
    discardFiles: vi.fn(async (urls: string[]) => { calls.push(`discard:${urls.join(',')}`) }),
  }
}

const ordersWith = (status: OrderStatus, calls: string[]) => ({
  findOne: vi.fn(async () => ({ id: 'o1', status })),
  find: vi.fn(async () => [{ id: 'o1' }, { id: 'o2' }]),
  delete: vi.fn(async () => { calls.push('delete'); return { affected: 1 } }),
})

const boss = { id: 'boss', role: UserRole.Manager }

const service = (orders: unknown, documents: ReturnType<typeof files>) =>
  new OrdersService(orders as never, {} as never, {} as never, {} as never, {} as never, documents as never, {} as never)

const leadsWith = (lead: unknown, remove: () => Promise<{ affected: number }>) =>
  new LeadsService({ findOne: vi.fn(async () => lead), delete: vi.fn(remove) } as never, {} as never, {} as never)

describe('removing orders and leads', () => {
  it('deletes the files of an order after the order itself', async () => {
    const documents = files()
    const orders = ordersWith(OrderStatus.Draft, documents.calls)

    await service(orders, documents).remove('o1', boss)

    expect(documents.calls).toEqual(['delete', 'discard:https://store/documents/o1.pdf'])
  })

  it('keeps the files when the order may not be deleted', async () => {
    const documents = files()
    const orders = ordersWith(OrderStatus.Paid, documents.calls)

    await expect(service(orders, documents).remove('o1', boss)).rejects.toThrow()
    expect(documents.discardFiles).not.toHaveBeenCalled()
  })

  it('deletes the files of every order of a removed lead, and only after the lead', async () => {
    const documents = files()
    const orders = ordersWith(OrderStatus.Draft, documents.calls)
    const leads = leadsWith({ id: 'l1', managerId: null, status: 'new' }, async () => {
      documents.calls.push('delete-lead')

      return { affected: 1 }
    })

    leads.registerRemovalHook(id => service(orders, documents).releaseLead(id))

    await leads.remove('l1', boss)

    expect(documents.calls).toEqual([
      'delete-lead',
      'discard:https://store/documents/o1.pdf,https://store/documents/o2.pdf',
    ])
  })

  it('touches no files when the lead does not exist', async () => {
    const documents = files()
    const orders = ordersWith(OrderStatus.Draft, documents.calls)
    const leads = leadsWith(null, async () => ({ affected: 0 }))

    leads.registerRemovalHook(id => service(orders, documents).releaseLead(id))

    await expect(leads.remove('missing', boss)).rejects.toBeInstanceOf(NotFoundException)
    expect(documents.discardFiles).not.toHaveBeenCalled()
  })
})
