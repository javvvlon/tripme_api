import { describe, expect, it, vi } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { OrdersService } from './orders.service'
import { OrderStatus } from './order.entity'
import { LeadsService } from '~/modules/leads/leads.service'

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

const service = (orders: unknown, documents: ReturnType<typeof files>) =>
  new OrdersService(orders as never, {} as never, {} as never, {} as never, {} as never, documents as never)

describe('removing orders and leads', () => {
  it('deletes the files of an order after the order itself', async () => {
    const documents = files()
    const orders = ordersWith(OrderStatus.Draft, documents.calls)

    await service(orders, documents).remove('o1')

    expect(documents.calls).toEqual(['delete', 'discard:https://store/documents/o1.pdf'])
  })

  it('keeps the files when the order may not be deleted', async () => {
    const documents = files()
    const orders = ordersWith(OrderStatus.Paid, documents.calls)

    await expect(service(orders, documents).remove('o1')).rejects.toThrow()
    expect(documents.discardFiles).not.toHaveBeenCalled()
  })

  it('deletes the files of every order of a removed lead, and only after the lead', async () => {
    const documents = files()
    const orders = ordersWith(OrderStatus.Draft, documents.calls)
    const leadsRepo = { delete: vi.fn(async () => { documents.calls.push('delete-lead'); return { affected: 1 } }) }
    const leads = new LeadsService(leadsRepo as never)

    leads.registerRemovalHook(id => service(orders, documents).releaseLead(id))

    await leads.remove('l1')

    expect(documents.calls).toEqual([
      'delete-lead',
      'discard:https://store/documents/o1.pdf,https://store/documents/o2.pdf',
    ])
  })

  it('touches no files when the lead does not exist', async () => {
    const documents = files()
    const orders = ordersWith(OrderStatus.Draft, documents.calls)
    const leads = new LeadsService({ delete: vi.fn(async () => ({ affected: 0 })) } as never)

    leads.registerRemovalHook(id => service(orders, documents).releaseLead(id))

    await expect(leads.remove('missing')).rejects.toBeInstanceOf(NotFoundException)
    expect(documents.discardFiles).not.toHaveBeenCalled()
  })
})
