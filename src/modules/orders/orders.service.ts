import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { PointsService } from '~/modules/points/points.service'
import { LEAD_TRANSITIONS, LeadEntity, LeadStatus } from '~/modules/leads/lead.entity'
import { ORDER_PREFIX, numberFromReference, reference } from '~/shared/helpers/reference'
import {
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  OrderEntity,
  OrderStatus,
  PASSPORT_CHECKED_STATUSES,
  PASSPORT_MARGIN_MONTHS,
  SETTLED_STATUSES,
} from './order.entity'
import { OrderEventEntity } from './order-event.entity'
import { DocumentsService } from './documents/documents.service'
import { pageOf } from '~/shared/helpers/pagination'
import type { IPage, IPageRequest } from '~/shared/helpers/pagination'

export interface IOrderTripInput {
  hotel_name?: string
  supplier_name?: string
  check_in?: string
  nights?: number
  adults?: number
  children?: number
  price_amount?: number
  price_currency?: string
  [key: string]: unknown
}

export interface IOrderCreateInput {
  trip?: IOrderTripInput
  traveller_name?: string
  country?: string
  deal_date?: string
  return_date?: string
  manager_id?: string | null
  branch?: string
  note?: string
  passport_id?: string
  passport_expires_at?: string
}

export interface IOrderPatchInput {
  status?: string
  traveller_name?: string
  country?: string
  hotel_name?: string
  supplier_name?: string
  deal_date?: string | null
  check_in?: string | null
  return_date?: string | null
  nights?: number
  adults?: number
  children?: number
  price_amount?: number | null
  price_currency?: string
  manager_id?: string | null
  branch?: string
  supplier_order_id?: string
  passport_id?: string
  passport_expires_at?: string | null
  note?: string
  cancel_reason?: string
}

export interface IOrderPayload {
  uuid: string
  order_no: number
  ref: string
  lead_id: string
  status: string
  traveller_name: string
  country: string
  deal_date: string | null
  return_date: string | null
  manager_id: string | null
  branch: string
  supplier_order_id: string
  passport_id: string
  passport_expires_at: string | null
  hotel_name: string
  supplier_name: string
  check_in: string | null
  nights: number
  adults: number
  children: number
  price_amount: number | null
  price_currency: string
  trip: Record<string, unknown>
  note: string
  cancel_reason: string
  created_at: string
  updated_at: string
}

const addDays = (day: string, count: number): string => {
  const at = new Date(`${day}T00:00:00Z`)

  at.setUTCDate(at.getUTCDate() + count)

  return at.toISOString().slice(0, 10)
}

const addMonths = (day: string, count: number): string => {
  const at = new Date(`${day}T00:00:00Z`)

  at.setUTCMonth(at.getUTCMonth() + count)

  return at.toISOString().slice(0, 10)
}

export function tripEnd(order: Pick<OrderEntity, 'returnDate' | 'checkIn' | 'nights'>): string | null {
  if (order.returnDate) return order.returnDate
  if (order.checkIn) return addDays(order.checkIn, order.nights || 0)

  return null
}

export function passportProblem(
  order: Pick<OrderEntity, 'returnDate' | 'checkIn' | 'nights' | 'passportExpiresAt'>,
): 'expired' | 'short' | null {
  const end = tripEnd(order)

  if (!order.passportExpiresAt || !end) return null
  if (order.passportExpiresAt <= end) return 'expired'
  if (order.passportExpiresAt < addMonths(end, PASSPORT_MARGIN_MONTHS)) return 'short'

  return null
}

const text = (value: unknown, limit = 160): string =>
  typeof value === 'string' ? value.trim().slice(0, limit) : ''

const count = (value: unknown): number =>
  Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : 0

const asDate = (value: unknown): string | null =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) ? String(value) : null

export interface IOrderQuery {
  q?: string
  status?: string
}

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    @InjectRepository(OrderEventEntity)
    private readonly events: Repository<OrderEventEntity>,
    @InjectRepository(LeadEntity)
    private readonly leads: Repository<LeadEntity>,
    private readonly dataSource: DataSource,
    private readonly points: PointsService,
    private readonly documentFiles: DocumentsService,
  ) {}

  async forLead(leadId: string): Promise<IOrderPayload[]> {
    const rows = await this.orders.find({ where: { leadId }, order: { createdAt: 'ASC' } })

    return rows.map(row => this.toPayload(row))
  }

  async list(query: IOrderQuery = {}): Promise<IOrderPayload[]> {
    const rows = await this.filtered(query).take(500).getMany()

    return rows.map(row => this.toPayload(row))
  }

  async page(query: IOrderQuery, request: IPageRequest): Promise<IPage<IOrderPayload, { all: number, live: number }>> {
    const [rows, total] = await this.filtered(query).skip(request.skip).take(request.perPage).getManyAndCount()
    const [all, done] = await Promise.all([
      this.orders.count(),
      this.orders.count({ where: { status: OrderStatus.Completed } }),
    ])

    return pageOf(rows.map(row => this.toPayload(row)), total, request, { all, live: all - done })
  }

  private filtered(query: IOrderQuery) {
    const builder = this.orders.createQueryBuilder('o')

    if (query.status && ORDER_STATUSES.includes(query.status as OrderStatus)) {
      builder.andWhere('o.status = :status', { status: query.status })
    }

    const needle = (query.q ?? '').trim()

    const byRef = numberFromReference(needle, ORDER_PREFIX)

    if (byRef !== null) {
      builder.andWhere('o.orderNo = :number', { number: byRef })
    }
    else if (needle) {
      const like = `%${needle.toLowerCase()}%`

      builder.andWhere(
        `(lower(o.travellerName) like :like or lower(o.hotelName) like :like
          or lower(o.supplierName) like :like or lower(o.country) like :like
          or lower(o.supplierOrderId) like :like or cast(o.orderNo as text) like :like)`,
        { like },
      )
    }

    return builder.orderBy('o.orderNo', 'DESC')
  }


  async one(id: string): Promise<IOrderPayload> {
    const order = await this.orders.findOne({ where: { id } })

    if (!order) throw new NotFoundException('Order not found')

    return this.toPayload(order)
  }

  async history(id: string) {
    const rows = await this.events.find({ where: { orderId: id }, order: { createdAt: 'ASC' } })

    return rows.map(row => ({
      from: row.fromStatus,
      to: row.toStatus,
      actor_id: row.actorId,
      at: row.createdAt.toISOString(),
    }))
  }

  async create(leadId: string, input: IOrderCreateInput, actorId: string | null): Promise<IOrderPayload> {
    const lead = await this.leads.findOne({ where: { id: leadId } })

    if (!lead) throw new NotFoundException('Lead not found')

    if (lead.status === LeadStatus.Rejected) {
      throw new ConflictException('A rejected lead cannot take new orders')
    }

    const trip = input.trip ?? {}
    const amount = Number(trip.price_amount)

    const order = this.orders.create({
      leadId,
      status: OrderStatus.Draft,
      note: text(input.note, 2000),
      passportId: text(input.passport_id, 40),
      passportExpiresAt: asDate(input.passport_expires_at),
      travellerName: text(input.traveller_name, 240),
      country: text(input.country, 120) || text(trip.route_to, 120),
      dealDate: asDate(input.deal_date),
      returnDate: asDate(input.return_date),
      managerId: typeof input.manager_id === 'string' ? input.manager_id : null,
      branch: text(input.branch, 120),
      hotelName: text(trip.hotel_name, 240),
      supplierName: text(trip.supplier_name, 120),
      checkIn: asDate(trip.check_in),
      nights: count(trip.nights),
      adults: count(trip.adults),
      children: count(trip.children),
      priceAmount: Number.isFinite(amount) && amount > 0 ? String(amount) : null,
      priceCurrency: text(trip.price_currency, 8),
      trip: trip as Record<string, unknown>,
    })

    const saved = await this.orders.save(order)

    await this.events.save(this.events.create({
      orderId: saved.id,
      fromStatus: null,
      toStatus: OrderStatus.Draft,
      actorId,
    }))

    return this.one(saved.id)
  }

  async patch(id: string, input: IOrderPatchInput, actorId: string | null): Promise<IOrderPayload> {
    return this.dataSource.transaction(async (manager) => {
      const orders = manager.getRepository(OrderEntity)
      const order = await orders.findOne({ where: { id } })

      if (!order) throw new NotFoundException('Order not found')

      let completed = false

      if (input.supplier_order_id !== undefined) order.supplierOrderId = text(input.supplier_order_id, 80)
      if (input.passport_id !== undefined) order.passportId = text(input.passport_id, 40)
      if (input.passport_expires_at !== undefined) order.passportExpiresAt = asDate(input.passport_expires_at)
      if (input.note !== undefined) order.note = text(input.note, 2000)
      if (input.traveller_name !== undefined) order.travellerName = text(input.traveller_name, 240)
      if (input.country !== undefined) order.country = text(input.country, 120)
      if (input.hotel_name !== undefined) order.hotelName = text(input.hotel_name, 240)
      if (input.supplier_name !== undefined) order.supplierName = text(input.supplier_name, 120)
      if (input.deal_date !== undefined) order.dealDate = asDate(input.deal_date)
      if (input.check_in !== undefined) order.checkIn = asDate(input.check_in)
      if (input.return_date !== undefined) order.returnDate = asDate(input.return_date)
      if (input.nights !== undefined) order.nights = count(input.nights)
      if (input.adults !== undefined) order.adults = count(input.adults)
      if (input.children !== undefined) order.children = count(input.children)
      if (input.price_currency !== undefined) order.priceCurrency = text(input.price_currency, 8)
      if (input.manager_id !== undefined) order.managerId = input.manager_id || null
      if (input.branch !== undefined) order.branch = text(input.branch, 120)

      if (input.price_amount !== undefined) {
        order.priceAmount = input.price_amount === null ? null : String(input.price_amount)
      }

      if (input.status !== undefined && input.status !== order.status) {
        const next = this.assertTransition(order.status, input.status)

        this.assertMayEnter(order, next, input.cancel_reason)

        await manager.getRepository(OrderEventEntity).save({
          orderId: order.id,
          fromStatus: order.status,
          toStatus: next,
          actorId,
        })

        order.status = next

        if (next === OrderStatus.Cancelled) order.cancelReason = text(input.cancel_reason, 500)

        await this.followOrder(manager.getRepository(LeadEntity), order.leadId, next)

        completed = next === OrderStatus.Completed
      }

      order.updatedAt = new Date()

      await orders.save(order)

      if (completed) await this.points.awardFor(order, manager)

      return this.toPayload(order)
    })
  }

  async remove(id: string): Promise<{ removed: boolean }> {
    const order = await this.orders.findOne({ where: { id } })

    if (!order) throw new NotFoundException('Order not found')

    if (SETTLED_STATUSES.includes(order.status as OrderStatus)) {
      throw new ConflictException('An order that has been paid cannot be deleted')
    }

    const files = await this.documentFiles.filesOf([id])

    await this.orders.delete({ id })
    await this.documentFiles.discardFiles(files)

    return { removed: true }
  }

  async releaseLead(leadId: string): Promise<() => Promise<void>> {
    const orders = await this.orders.find({ where: { leadId }, select: { id: true } })
    const files = await this.documentFiles.filesOf(orders.map(order => order.id))

    return () => this.documentFiles.discardFiles(files)
  }

  async assertLeadMayBecome(leadId: string, next: string): Promise<void> {
    if (next !== LeadStatus.Rejected) return

    const settled = await this.orders
      .createQueryBuilder('o')
      .where('o.leadId = :leadId', { leadId })
      .andWhere('o.status in (:...statuses)', { statuses: SETTLED_STATUSES })
      .getCount()

    if (settled) {
      throw new ConflictException('This lead has a paid order and cannot be rejected')
    }
  }

  private assertMayEnter(order: OrderEntity, next: OrderStatus, cancelReason?: string): void {
    if (next === OrderStatus.Cancelled && !text(cancelReason, 500)) {
      throw new BadRequestException('A cancelled order needs a reason')
    }

    if (!PASSPORT_CHECKED_STATUSES.includes(next)) return

    const problem = passportProblem(order)

    if (problem === 'expired') {
      throw new ConflictException('The passport expires before the trip ends')
    }

    if (problem === 'short') {
      throw new ConflictException(`The passport must stay valid ${PASSPORT_MARGIN_MONTHS} months after the trip ends`)
    }
  }

  private assertTransition(from: string, to: string): OrderStatus {
    if (!ORDER_STATUSES.includes(to as OrderStatus)) {
      throw new BadRequestException('Unknown order status')
    }

    const allowed = ORDER_TRANSITIONS[from as OrderStatus] ?? []

    if (!allowed.includes(to as OrderStatus)) {
      throw new ConflictException(`An order cannot go from ${from} to ${to}`)
    }

    return to as OrderStatus
  }

  private async followOrder(leads: Repository<LeadEntity>, leadId: string, status: OrderStatus): Promise<void> {
    const lead = await leads.findOne({ where: { id: leadId } })

    if (!lead) return

    const wanted = status === OrderStatus.Requested && lead.status === LeadStatus.New
      ? LeadStatus.InProgress
      : SETTLED_STATUSES.includes(status) || status === OrderStatus.Confirmed
        ? LeadStatus.Won
        : null

    if (!wanted || wanted === lead.status) return

    if (!(LEAD_TRANSITIONS[lead.status as LeadStatus] ?? []).includes(wanted)) return

    if (lead.status === LeadStatus.New && !lead.firstResponseAt) lead.firstResponseAt = new Date()

    lead.status = wanted
    lead.updatedAt = new Date()

    await leads.save(lead)
  }

  private toPayload(row: OrderEntity): IOrderPayload {
    return {
      uuid: row.id,
      order_no: Number(row.orderNo ?? 0),
      ref: reference(ORDER_PREFIX, Number(row.orderNo ?? 0), row.createdAt),
      lead_id: row.leadId,
      status: row.status,
      traveller_name: row.travellerName ?? '',
      country: row.country ?? '',
      deal_date: row.dealDate,
      return_date: row.returnDate,
      manager_id: row.managerId,
      branch: row.branch ?? '',
      supplier_order_id: row.supplierOrderId ?? '',
      passport_id: row.passportId ?? '',
      passport_expires_at: row.passportExpiresAt,
      hotel_name: row.hotelName,
      supplier_name: row.supplierName,
      check_in: row.checkIn,
      nights: row.nights,
      adults: row.adults,
      children: row.children,
      price_amount: row.priceAmount === null ? null : Number(row.priceAmount),
      price_currency: row.priceCurrency,
      trip: row.trip ?? {},
      note: row.note ?? '',
      cancel_reason: row.cancelReason ?? '',
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    }
  }
}
