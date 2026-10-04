import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { LeadEntity } from '~/modules/leads/lead.entity'
import { OrderEntity } from '~/modules/orders/order.entity'
import { OrderEventEntity } from '~/modules/orders/order-event.entity'
import { UserEntity } from '~/modules/auth/entities'
import { DocumentsService } from '~/modules/orders/documents/documents.service'
import type { IDocumentPayload } from '~/modules/orders/documents/documents.service'
import { ORDER_PREFIX, reference } from '~/shared/helpers/reference'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface ICustomerOrder {
  uuid: string
  order_no: number
  ref: string
  status: string
  country: string
  hotel_name: string
  supplier_name: string
  check_in: string | null
  return_date: string | null
  nights: number
  adults: number
  children: number
  price_amount: number | null
  price_currency: string
  supplier_order_id: string
  manager: { name: string } | null
  created_at: string
  updated_at: string
}

export interface ICustomerOrderDetail extends ICustomerOrder {
  history: Array<{ from: string | null, to: string, at: string }>
  documents: IDocumentPayload[]
}

@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(LeadEntity)
    private readonly leads: Repository<LeadEntity>,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    @InjectRepository(OrderEventEntity)
    private readonly events: Repository<OrderEventEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly documents: DocumentsService,
  ) {}

  async list(userId: string): Promise<ICustomerOrder[]> {
    const leads = await this.leads.find({ where: { userId }, select: { id: true } })

    if (!leads.length) return []

    const rows = await this.orders.find({
      where: { leadId: In(leads.map(lead => lead.id)) },
      order: { createdAt: 'DESC' },
    })

    const managers = await this.managersFor(rows)

    return rows.map(row => this.toPayload(row, managers))
  }

  async one(userId: string, orderId: string): Promise<ICustomerOrderDetail> {
    const row = await this.orders.findOne({ where: { id: orderId } })

    if (!row) throw new NotFoundException('Order not found')

    const lead = await this.leads.findOne({ where: { id: row.leadId }, select: { id: true, userId: true } })

    if (!lead || lead.userId !== userId) throw new NotFoundException('Order not found')

    const [managers, events, documents] = await Promise.all([
      this.managersFor([row]),
      this.events.find({ where: { orderId }, order: { createdAt: 'ASC' } }),
      this.documents.list(orderId),
    ])

    return {
      ...this.toPayload(row, managers),
      history: events.map(event => ({
        from: event.fromStatus,
        to: event.toStatus,
        at: event.createdAt.toISOString(),
      })),
      documents,
    }
  }

  private async managersFor(rows: OrderEntity[]): Promise<Map<string, string>> {
    const ids = [...new Set(rows.map(row => row.managerId).filter((id): id is string => Boolean(id)))]

    if (!ids.length) return new Map()

    const found = await this.users.find({ where: { id: In(ids) }, select: { id: true, firstName: true, lastName: true } })

    return new Map(found.map(user => [user.id, [user.firstName, user.lastName].filter(Boolean).join(' ')]))
  }

  private toPayload(row: OrderEntity, managers: Map<string, string>): ICustomerOrder {
    const manager = row.managerId ? managers.get(row.managerId) : undefined

    return {
      uuid: row.id,
      order_no: Number(row.orderNo ?? 0),
      ref: reference(ORDER_PREFIX, Number(row.orderNo ?? 0), row.createdAt),
      status: row.status,
      country: row.country ?? '',
      hotel_name: row.hotelName ?? '',
      supplier_name: row.supplierName ?? '',
      check_in: row.checkIn,
      return_date: row.returnDate,
      nights: row.nights ?? 0,
      adults: row.adults ?? 0,
      children: row.children ?? 0,
      price_amount: row.priceAmount === null ? null : Number(row.priceAmount),
      price_currency: row.priceCurrency ?? '',
      supplier_order_id: row.supplierOrderId ?? '',
      manager: manager ? { name: manager } : null,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    }
  }
}
