import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, In, Repository } from 'typeorm'
import type { EntityManager } from 'typeorm'
import { PointsService } from '~/modules/points/points.service'
import { LEAD_TRANSITIONS, LeadEntity, LeadStatus } from '~/modules/leads/lead.entity'
import { LeadsService } from '~/modules/leads/leads.service'
import { LeadEventKind } from '~/modules/leads/lead-event.entity'
import { canSeeLead, canSeeOrder, seesEveryone } from '~/modules/leads/lead.access'
import type { IViewer } from '~/modules/leads/lead.access'
import { ORDER_PREFIX, numberFromReference, reference } from '~/shared/helpers/reference'
import {
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  OrderEntity,
  OrderStatus,
  PASSPORT_CHECKED_STATUSES,
  PASSPORT_MARGIN_MONTHS,
  SETTLED_STATUSES,
  COMMITTED_STATUSES,
} from './order.entity'
import { OrderEventEntity } from './order-event.entity'
import { DocumentsService } from './documents/documents.service'
import { OrderItemsService } from './items/order-items.service'
import { ItemKind } from './items/item-kinds'
import { advanceTarget, confirmationOf } from './confirmation.rules'
import { assertOrderTakesServices } from './items/item-rules'
import type { IOrderItemInput } from './items/item-rules'
import type { IConfirmation } from './confirmation.rules'
import type { IOrderItemPayload } from './items/order-items.service'
import { documentMoneyOf } from './documents/document-lines'
import type { IDocumentMoney } from './documents/document-lines'
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
  manager_name: string
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
  items: IOrderItemPayload[]
  payment_status: string
  balance_uzs: number
  deposit_percent: number | null
  legacy_paid: boolean
  contract_signed_at: string | null
  confirmation: IConfirmation
  note: string
  cancel_reason: string
  archived_at: string | null
  client_id: string | null
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

export interface IOrderMoneyInput {
  id: string
  depositPercent: number | null
  legacyPaid: boolean
  items: IOrderItemPayload[]
}

export interface IOrderMoney {
  paymentStatus: string
  balanceUzs: number
  receivedUzs: number
  depositUzs: number
  depositMet: boolean
}

export type OrderEvent =
  | { type: 'status', orderId: string, to: string }
  | { type: 'issued', orderId: string, itemId: string }
  | { type: 'payment', orderId: string, amountUzs: number }

export interface IOrderQuery {
  q?: string
  status?: string
  manager?: string
  archived?: string
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
    private readonly leadsService: LeadsService,
    private readonly itemsService: OrderItemsService,
  ) {}

  private readonly eventListeners: Array<(event: OrderEvent) => Promise<void>> = []

  onEvent(listener: (event: OrderEvent) => Promise<void>): void {
    this.eventListeners.push(listener)
  }

  emit(event: OrderEvent): void {
    for (const listener of this.eventListeners) void listener(event).catch(() => undefined)
  }

  private paymentsOf: ((orders: IOrderMoneyInput[]) => Promise<Map<string, IOrderMoney>>) | null = null

  registerMoney(reader: (orders: IOrderMoneyInput[]) => Promise<Map<string, IOrderMoney>>): void {
    this.paymentsOf = reader
  }

  private documentGuard: ((documentId: string) => Promise<void>) | null = null

  registerDocumentGuard(guard: (documentId: string) => Promise<void>): void {
    this.documentGuard = guard
  }

  async assertDocumentRemovable(documentId: string): Promise<void> {
    await this.documentGuard?.(documentId)
  }

  async itemsOf(orderId: string): Promise<IOrderItemPayload[]> {
    return (await this.itemsService.byOrder([orderId])).get(orderId) ?? []
  }

  async moneyContextOf(orderId: string): Promise<{ depositPercent: number | null, legacyPaid: boolean }> {
    const order = await this.orders.findOne({ where: { id: orderId } })

    return { depositPercent: order?.depositPercent ?? null, legacyPaid: order?.legacyPaid ?? false }
  }

  async confirmItem(orderId: string, itemId: string, supplierRef: unknown, viewer: IViewer): Promise<IOrderPayload> {
    await this.visible(orderId, viewer)

    const ref = text(supplierRef, 80)

    if (!ref) throw new BadRequestException('The supplier booking number is required')

    const order = await this.dataSource.transaction(async (manager) => {
      const item = await this.itemsService.confirm(manager, orderId, itemId, ref)
      const orders = manager.getRepository(OrderEntity)
      const found = await orders.findOne({ where: { id: orderId } })

      if (!found) throw new NotFoundException('Order not found')

      if (item.kind === ItemKind.Package) {
        found.supplierOrderId = ref
        found.updatedAt = new Date()
        await orders.save(found)
      }

      return found
    })

    await this.advance(order.id, viewer.id)

    return this.one(order.id, viewer)
  }

  async advance(orderId: string, actorId: string | null): Promise<boolean> {
    const order = await this.orders.findOne({ where: { id: orderId } })

    if (!order) return false

    const items = await this.itemsService.byOrder([orderId])
    const money = await this.moneyOf([order], items)
    const confirmation = this.confirmationFor(order, items.get(orderId) ?? [], money.get(orderId))
    const target = advanceTarget(order.status, confirmation, passportProblem(order))

    if (!target) return false

    const path = target === 'confirmed' && order.status === OrderStatus.Draft
      ? [OrderStatus.Requested, OrderStatus.Confirmed]
      : [target as OrderStatus]

    const moved = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(OrderEntity)
      const fresh = await repository.findOne({ where: { id: orderId } })

      if (!fresh || fresh.status !== order.status) return false

      for (const next of path) await this.moveTo(manager, fresh, next, actorId)

      fresh.updatedAt = new Date()
      await repository.save(fresh)
      await this.itemsService.syncPackage(manager, fresh)
      await this.itemsService.syncExtras(manager, fresh)

      return true
    })

    if (moved) this.emit({ type: 'status', orderId, to: path.at(-1)! })

    return moved
  }

  private async moveTo(manager: EntityManager, order: OrderEntity, next: OrderStatus, actorId: string | null): Promise<void> {
    await manager.getRepository(OrderEventEntity).save({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: next,
      actorId,
    })

    order.status = next

    if (actorId) await this.followOrder(manager, order.leadId, next, actorId)
  }

  async addItem(orderId: string, input: IOrderItemInput, viewer: IViewer): Promise<IOrderPayload> {
    return this.changeItems(orderId, viewer, async (manager, order) => {
      assertOrderTakesServices(order.status)
      await this.itemsService.add(manager, order, input ?? {})
    })
  }

  async updateItem(orderId: string, itemId: string, input: IOrderItemInput, viewer: IViewer): Promise<IOrderPayload> {
    return this.changeItems(orderId, viewer, async (manager) => {
      await this.itemsService.update(manager, orderId, itemId, input ?? {})
    })
  }

  async removeItem(orderId: string, itemId: string, viewer: IViewer): Promise<IOrderPayload> {
    return this.changeItems(orderId, viewer, async (manager) => {
      await this.itemsService.remove(manager, orderId, itemId)
    })
  }

  async assertItemIssuable(orderId: string, itemId: string, viewer: IViewer): Promise<void> {
    await this.visible(orderId, viewer)
    await this.itemsService.assertIssuable(orderId, itemId)
  }

  async issueItem(orderId: string, itemId: string, documentId: string | null, viewer: IViewer): Promise<IOrderPayload> {
    const payload = await this.changeItems(orderId, viewer, async (manager) => {
      await this.itemsService.issue(manager, orderId, itemId, documentId)
    })

    this.emit({ type: 'issued', orderId, itemId })

    return payload
  }

  private async changeItems(
    orderId: string,
    viewer: IViewer,
    work: (manager: EntityManager, order: OrderEntity) => Promise<void>,
  ): Promise<IOrderPayload> {
    await this.visible(orderId, viewer)

    const order = await this.dataSource.transaction(async (manager) => {
      const orders = manager.getRepository(OrderEntity)
      const found = await orders.findOne({ where: { id: orderId } })

      if (!found) throw new NotFoundException('Order not found')

      await work(manager, found)

      found.updatedAt = new Date()
      await orders.save(found)

      return found
    })

    return (await this.payloads([order]))[0]!
  }

  async customerMoney(orderId: string): Promise<IDocumentMoney & { paymentStatus: string }> {
    const order = await this.orders.findOne({ where: { id: orderId } })

    if (!order) throw new NotFoundException('Order not found')

    const items = await this.itemsService.byOrder([orderId])
    const money = (await this.moneyOf([order], items)).get(orderId)

    return {
      ...documentMoneyOf(items.get(orderId) ?? [], money?.receivedUzs ?? 0, money?.balanceUzs ?? 0),
      paymentStatus: money?.paymentStatus ?? 'unpaid',
    }
  }

  async documentMoney(orderId: string): Promise<IDocumentMoney> {
    const order = await this.orders.findOne({ where: { id: orderId } })

    if (!order) throw new NotFoundException('Order not found')

    const items = await this.itemsService.byOrder([orderId])
    const money = (await this.moneyOf([order], items)).get(orderId)

    return documentMoneyOf(items.get(orderId) ?? [], money?.receivedUzs ?? 0, money?.balanceUzs ?? 0)
  }

  async markContract(orderId: string, documentId: string): Promise<void> {
    await this.orders.update({ id: orderId }, { contractSignedAt: new Date(), contractDocumentId: documentId, updatedAt: new Date() })
  }

  async documentRemoved(documentId: string): Promise<void> {
    await this.orders.update({ contractDocumentId: documentId }, { contractSignedAt: null, contractDocumentId: null, updatedAt: new Date() })
    await this.itemsService.forgetDocument(documentId)
  }

  async setDepositPercent(orderId: string, percent: unknown, viewer: IViewer): Promise<void> {
    const order = await this.visible(orderId, viewer)
    const value = percent === null ? null : Number(percent)

    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 100)) {
      throw new BadRequestException('The deposit must be a whole percent from 0 to 100')
    }

    order.depositPercent = value
    order.updatedAt = new Date()

    await this.orders.save(order)
  }

  async setItemRate(orderId: string, itemId: string, rate: unknown, viewer: IViewer): Promise<void> {
    await this.visible(orderId, viewer)
    await this.itemsService.setRate(orderId, itemId, rate)
  }

  async forLead(leadId: string, viewer: IViewer): Promise<IOrderPayload[]> {
    const lead = await this.leads.findOne({ where: { id: leadId } })

    if (!lead || !canSeeLead(viewer, lead)) throw new NotFoundException('Lead not found')

    const rows = (await this.orders.find({ where: { leadId }, order: { createdAt: 'ASC' } }))
      .filter(row => canSeeOrder(viewer, row, lead))

    return this.payloads(rows)
  }

  async list(query: IOrderQuery, viewer: IViewer): Promise<IOrderPayload[]> {
    const rows = await this.filtered(query, viewer).take(500).getMany()

    return this.payloads(rows)
  }

  async page(
    query: IOrderQuery,
    request: IPageRequest,
    viewer: IViewer,
  ): Promise<IPage<IOrderPayload, { all: number, live: number }>> {
    const [rows, total] = await this.filtered(query, viewer).skip(request.skip).take(request.perPage).getManyAndCount()
    const [all, done, items] = await Promise.all([
      this.filtered({}, viewer).getCount(),
      this.filtered({ status: OrderStatus.Completed }, viewer).getCount(),
      this.payloads(rows),
    ])

    return pageOf(items, total, request, { all, live: all - done })
  }

  private filtered(query: IOrderQuery, viewer: IViewer) {
    const builder = this.orders.createQueryBuilder('o').leftJoin(LeadEntity, 'lead', 'lead.id = o.leadId')

    builder.andWhere(query.archived === '1'
      ? '(o.archivedAt is not null or lead.archivedAt is not null)'
      : 'o.archivedAt is null and lead.archivedAt is null')

    if (!seesEveryone(viewer)) {
      builder.andWhere('(o.managerId = :viewer or (o.managerId is null and lead.managerId = :viewer))', { viewer: viewer.id })
    }

    if (query.manager === 'me') builder.andWhere('o.managerId = :me', { me: viewer.id })
    else if (query.manager === 'none') builder.andWhere('o.managerId is null')
    else if (query.manager && /^[0-9a-f-]{36}$/i.test(query.manager)) {
      builder.andWhere('o.managerId = :manager', { manager: query.manager })
    }

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

  async one(id: string, viewer: IViewer): Promise<IOrderPayload> {
    const order = await this.visible(id, viewer)

    return (await this.payloads([order]))[0]!
  }

  async assertVisible(id: string, viewer: IViewer): Promise<void> {
    await this.visible(id, viewer)
  }

  async history(id: string, viewer: IViewer) {
    await this.visible(id, viewer)

    const rows = await this.events.find({ where: { orderId: id }, order: { createdAt: 'ASC' } })
    const names = await this.leadsService.namesOf(rows.map(row => row.actorId))

    return rows.map(row => ({
      from: row.fromStatus,
      to: row.toStatus,
      actor_id: row.actorId,
      actor_name: row.actorId ? names.get(row.actorId) ?? null : null,
      at: row.createdAt.toISOString(),
    }))
  }

  async create(leadId: string, input: IOrderCreateInput, viewer: IViewer): Promise<IOrderPayload> {
    const lead = await this.leads.findOne({ where: { id: leadId } })

    if (!lead || !canSeeLead(viewer, lead)) throw new NotFoundException('Lead not found')

    if (lead.status === LeadStatus.Rejected) {
      throw new ConflictException('A rejected lead cannot take new orders')
    }

    if (lead.archivedAt) throw new ConflictException('Restore the lead before creating an order')

    const trip = input.trip ?? {}
    const amount = Number(trip.price_amount)

    if (!text(trip.hotel_name, 240) && !text(lead.hotelName, 240)) {
      throw new ConflictException('Pick a tour for the lead before creating an order')
    }

    const order = this.orders.create({
      leadId,
      status: OrderStatus.Draft,
      note: text(input.note, 2000),
      passportId: text(input.passport_id, 40),
      passportExpiresAt: asDate(input.passport_expires_at),
      travellerName: text(input.traveller_name, 240),
      country: text(input.country, 120) || text(trip.route_to_label, 120) || text(trip.route_to, 120),
      dealDate: asDate(input.deal_date),
      returnDate: asDate(input.return_date),
      managerId: null,
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

    const saved = await this.dataSource.transaction(async (manager) => {
      await this.leadsService.claimForOrder(manager, lead, viewer)

      order.managerId = lead.managerId

      const stored = await manager.getRepository(OrderEntity).save(order)

      await this.itemsService.syncPackage(manager, stored)

      await manager.getRepository(OrderEventEntity).save({
        orderId: stored.id,
        fromStatus: null,
        toStatus: OrderStatus.Draft,
        actorId: viewer.id,
      })

      return stored
    })

    return this.one(saved.id, viewer)
  }

  async patch(id: string, input: IOrderPatchInput, viewer: IViewer): Promise<IOrderPayload> {
    await this.visible(id, viewer)

    const actorId = viewer.id

    const saved = await this.dataSource.transaction(async (manager) => {
      const orders = manager.getRepository(OrderEntity)
      const order = await orders.findOne({ where: { id } })

      if (!order) throw new NotFoundException('Order not found')

      let completed = false
      let movedTo: string | null = null

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
      if (input.manager_id !== undefined && (input.manager_id || null) !== order.managerId) {
        if (!seesEveryone(viewer)) throw new ForbiddenException('Only a manager can reassign an order')

        const target = input.manager_id || null

        if (target) await this.leadsService.assertStaff(target)

        await this.leadsService.record(manager, order.leadId, LeadEventKind.OrderAssigned, {
          from: order.managerId,
          to: target,
          subject: reference(ORDER_PREFIX, Number(order.orderNo ?? 0), order.createdAt),
          actorId,
        })

        order.managerId = target
      }
      if (input.branch !== undefined) order.branch = text(input.branch, 120)

      if (input.price_amount !== undefined) {
        order.priceAmount = input.price_amount === null ? null : String(input.price_amount)
      }

      if (input.status !== undefined && input.status !== order.status) {
        const next = this.assertTransition(order.status, input.status)

        this.assertMayEnter(order, next, input.cancel_reason)

        if (next === OrderStatus.Confirmed) await this.assertConfirmable(order)

        await this.moveTo(manager, order, next, actorId)

        if (next === OrderStatus.Cancelled) order.cancelReason = text(input.cancel_reason, 500)

        completed = next === OrderStatus.Completed
        movedTo = next
      }

      order.updatedAt = new Date()

      await orders.save(order)
      await this.itemsService.syncPackage(manager, order)
      await this.itemsService.syncExtras(manager, order)

      if (completed) await this.points.awardFor(order, manager)

      return { order, movedTo }
    })

    if (saved.movedTo) this.emit({ type: 'status', orderId: id, to: saved.movedTo })

    const passportTouched = input.passport_expires_at !== undefined || input.passport_id !== undefined

    if (passportTouched && input.status === undefined && await this.advance(id, actorId)) return this.one(id, viewer)

    return (await this.payloads([saved.order]))[0]!
  }

  async archive(id: string, viewer: IViewer): Promise<IOrderPayload> {
    return this.setArchived(id, viewer, true)
  }

  async restore(id: string, viewer: IViewer): Promise<IOrderPayload> {
    return this.setArchived(id, viewer, false)
  }

  private async setArchived(id: string, viewer: IViewer, archived: boolean): Promise<IOrderPayload> {
    const order = await this.visible(id, viewer)

    if (Boolean(order.archivedAt) !== archived) {
      order.archivedAt = archived ? new Date() : null
      order.archivedBy = archived ? viewer.id : null
      order.updatedAt = new Date()

      await this.orders.save(order)
    }

    return (await this.payloads([order]))[0]!
  }

  async assertLeadMayBecome(leadId: string, next: string): Promise<void> {
    if (next !== LeadStatus.Rejected) return

    const settled = await this.orders
      .createQueryBuilder('o')
      .where('o.leadId = :leadId', { leadId })
      .andWhere('o.status in (:...statuses)', { statuses: COMMITTED_STATUSES })
      .getCount()

    if (settled) {
      throw new ConflictException('This lead has a confirmed order and cannot be rejected')
    }
  }

  private async assertConfirmable(order: OrderEntity): Promise<void> {
    const items = await this.itemsService.byOrder([order.id])
    const money = await this.moneyOf([order], items)
    const confirmation = this.confirmationFor(order, items.get(order.id) ?? [], money.get(order.id))

    if (confirmation.ready || confirmation.mode !== 'enforce') return

    throw new ConflictException({
      message: `The order cannot be confirmed yet: ${confirmation.missing.join(', ')}`,
      code: 'confirmation_incomplete',
      missing: confirmation.missing,
    })
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

  private async followOrder(manager: EntityManager, leadId: string, status: OrderStatus, actorId: string): Promise<void> {
    const leads = manager.getRepository(LeadEntity)
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

    await this.leadsService.record(manager, lead.id, LeadEventKind.Status, { from: lead.status, to: wanted, actorId })

    lead.status = wanted
    lead.updatedAt = new Date()

    await leads.save(lead)
  }

  private async visible(id: string, viewer: IViewer): Promise<OrderEntity> {
    const order = await this.orders.findOne({ where: { id } })

    if (!order) throw new NotFoundException('Order not found')

    if (seesEveryone(viewer) || order.managerId === viewer.id) return order

    const lead = order.managerId ? null : await this.leads.findOne({ where: { id: order.leadId } })

    if (!canSeeOrder(viewer, order, lead)) throw new NotFoundException('Order not found')

    return order
  }

  private async payloads(rows: OrderEntity[]): Promise<IOrderPayload[]> {
    const ids = rows.map(row => row.id)
    const leadIds = [...new Set(rows.map(row => row.leadId))]
    const [names, items, leads] = await Promise.all([
      this.leadsService.namesOf(rows.map(row => row.managerId)),
      this.itemsService.byOrder(ids),
      leadIds.length ? this.leads.find({ where: { id: In(leadIds) }, select: { id: true, userId: true } }) : Promise.resolve([]),
    ])
    const clients = new Map(leads.map(lead => [lead.id, lead.userId]))

    const money = await this.moneyOf(rows, items)

    return rows.map(row => ({ ...this.toPayload(row, names, items.get(row.id) ?? [], money.get(row.id)), client_id: clients.get(row.leadId) ?? null }))
  }

  private async moneyOf(rows: OrderEntity[], items: Map<string, IOrderItemPayload[]>): Promise<Map<string, IOrderMoney>> {
    if (!this.paymentsOf) return new Map()

    return this.paymentsOf(rows.map(row => ({
      id: row.id,
      depositPercent: row.depositPercent,
      legacyPaid: row.legacyPaid,
      items: items.get(row.id) ?? [],
    })))
  }

  private confirmationFor(row: OrderEntity, items: IOrderItemPayload[], money: IOrderMoney | undefined): IConfirmation {
    return confirmationOf({
      items: items.map(item => ({ title: item.title, kind: item.kind, status: item.status, required: item.required_for_confirmation })),
      contractSignedAt: row.contractSignedAt,
      depositMet: money?.depositMet ?? false,
      receivedUzs: money?.receivedUzs ?? 0,
      depositUzs: money?.depositUzs ?? 0,
      legacyPaid: row.legacyPaid,
      passportExpiresAt: row.passportExpiresAt,
      passportProblem: passportProblem(row),
    })
  }

  private toPayload(
    row: OrderEntity,
    names: Map<string, string>,
    items: IOrderItemPayload[],
    money: IOrderMoney | undefined,
  ): IOrderPayload {
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
      manager_name: row.managerId ? names.get(row.managerId) ?? '' : '',
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
      items,
      payment_status: money?.paymentStatus ?? 'unpaid',
      balance_uzs: money?.balanceUzs ?? 0,
      deposit_percent: row.depositPercent,
      legacy_paid: row.legacyPaid,
      contract_signed_at: row.contractSignedAt ? row.contractSignedAt.toISOString() : null,
      confirmation: this.confirmationFor(row, items, money),
      note: row.note ?? '',
      cancel_reason: row.cancelReason ?? '',
      archived_at: row.archivedAt ? row.archivedAt.toISOString() : null,
      client_id: null,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    }
  }
}
