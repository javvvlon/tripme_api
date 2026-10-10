import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import type { EntityManager } from 'typeorm'
import { RatesService } from '~/modules/references/rates.service'
import { itemUzs, rateFor } from '~/modules/finance/finance.rules'
import { OrderItemEntity } from './order-item.entity'
import { CONFIRMED_ITEM, INACTIVE_ITEM, ItemKind, ItemStatus, followOrderForExtra, followOrderStatus, isTracked, packageFromOrder } from './item-kinds'
import { assertEditable, assertIssuable, firstStatusFor, itemFieldsOf, removalOf } from './item-rules'
import type { IItemFields, IOrderItemInput, ItemRemoval } from './item-rules'
import type { OrderEntity } from '../order.entity'

export interface IOrderItemPayload {
  uuid: string
  position: number
  kind: string
  status: string
  title: string
  supplier_name: string
  supplier_ref: string
  offer_id: string
  service_start: string | null
  service_end: string | null
  price_amount: number | null
  price_currency: string
  price_uzs: number | null
  cost_amount: number | null
  cost_currency: string
  fx_rate: number | null
  agreed_rate: number | null
  fx_date: string | null
  required_for_confirmation: boolean
  details: Record<string, unknown>
}

const today = (): string => new Date().toISOString().slice(0, 10)

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class OrderItemsService {
  constructor(
    @InjectRepository(OrderItemEntity)
    private readonly items: Repository<OrderItemEntity>,
    private readonly rates: RatesService,
  ) {}

  async syncPackage(manager: EntityManager, order: OrderEntity): Promise<void> {
    const repository = manager.getRepository(OrderItemEntity)
    const fields = packageFromOrder(order)
    const existing = await repository.findOne({
      where: { orderId: order.id, kind: ItemKind.Package },
      order: { position: 'ASC' },
    })

    const keepsRate = existing && existing.fxRate !== null && existing.priceCurrency === fields.priceCurrency
    const frozen = keepsRate
      ? { fxRate: existing.fxRate, fxDate: existing.fxDate }
      : await this.freeze(fields.priceCurrency)

    if (existing) {
      Object.assign(existing, fields, frozen, {
        position: existing.position,
        status: followOrderStatus(existing.status, order.status),
        supplierRef: fields.supplierRef || existing.supplierRef,
        updatedAt: new Date(),
      })
      await repository.save(existing)
      return
    }

    await repository.save(repository.create({ ...fields, ...frozen, orderId: order.id }))
  }

  async syncExtras(manager: EntityManager, order: OrderEntity): Promise<void> {
    const repository = manager.getRepository(OrderItemEntity)
    const extras = (await repository.find({ where: { orderId: order.id } })).filter(item => item.kind !== ItemKind.Package)

    for (const item of extras) {
      const next = followOrderForExtra(item.status, order.status, item.kind)

      if (next === item.status) continue

      item.status = next
      item.updatedAt = new Date()
      await repository.save(item)
    }
  }

  async add(manager: EntityManager, order: OrderEntity, input: IOrderItemInput): Promise<OrderItemEntity> {
    const repository = manager.getRepository(OrderItemEntity)
    const fields = itemFieldsOf(input)
    const last = await repository.findOne({ where: { orderId: order.id }, order: { position: 'DESC' } })

    return repository.save(repository.create({
      ...this.columnsOf(fields),
      ...await this.freeze(fields.priceCurrency),
      orderId: order.id,
      position: (last?.position ?? 0) + 1,
      status: firstStatusFor(order.status, fields.kind),
    }))
  }

  async update(manager: EntityManager, orderId: string, itemId: string, input: IOrderItemInput): Promise<OrderItemEntity> {
    const repository = manager.getRepository(OrderItemEntity)
    const item = await this.found(repository, orderId, itemId)

    assertEditable(item)

    const fields = itemFieldsOf({ ...input, kind: input.kind ?? item.kind }, this.fieldsOf(item))
    const frozen = fields.priceCurrency === item.priceCurrency && item.fxRate !== null
      ? { fxRate: item.fxRate, fxDate: item.fxDate }
      : await this.freeze(fields.priceCurrency)

    Object.assign(item, this.columnsOf(fields, item.details), frozen, { updatedAt: new Date() })

    return repository.save(item)
  }

  async remove(manager: EntityManager, orderId: string, itemId: string): Promise<ItemRemoval> {
    const repository = manager.getRepository(OrderItemEntity)
    const item = await this.found(repository, orderId, itemId)
    const removal = removalOf(item)

    if (removal === 'delete') {
      await repository.delete({ id: item.id })
      return removal
    }

    item.status = ItemStatus.Cancelled
    item.updatedAt = new Date()
    await repository.save(item)

    return removal
  }

  async issue(manager: EntityManager, orderId: string, itemId: string, documentId: string | null): Promise<OrderItemEntity> {
    const repository = manager.getRepository(OrderItemEntity)
    const item = await this.found(repository, orderId, itemId)

    assertIssuable(item)

    item.status = ItemStatus.Issued
    item.details = documentId ? { ...item.details, document_id: documentId } : item.details
    item.updatedAt = new Date()

    return repository.save(item)
  }

  async assertIssuable(orderId: string, itemId: string): Promise<void> {
    assertIssuable(await this.found(this.items, orderId, itemId))
  }

  async forgetDocument(documentId: string): Promise<void> {
    const rows = await this.items
      .createQueryBuilder('i')
      .where(`i.details ->> 'document_id' = :documentId`, { documentId })
      .getMany()

    for (const row of rows) {
      const { document_id: _, ...details } = row.details

      row.details = details
      row.updatedAt = new Date()
      await this.items.save(row)
    }
  }

  async confirm(manager: EntityManager, orderId: string, itemId: string, supplierRef: string): Promise<OrderItemEntity> {
    const repository = manager.getRepository(OrderItemEntity)
    const item = await repository.findOne({ where: { id: itemId, orderId } })

    if (!item) throw new NotFoundException('Service not found')
    if (INACTIVE_ITEM.includes(item.status)) throw new BadRequestException('A cancelled service cannot be confirmed')
    if (!isTracked(item.kind)) throw new BadRequestException('This service has no supplier confirmation')

    item.supplierRef = supplierRef
    if (!CONFIRMED_ITEM.includes(item.status)) item.status = ItemStatus.Confirmed
    item.updatedAt = new Date()

    return repository.save(item)
  }

  async byOrder(orderIds: string[]): Promise<Map<string, IOrderItemPayload[]>> {
    const grouped = new Map<string, IOrderItemPayload[]>()

    if (!orderIds.length) return grouped

    const rows = await this.items.find({
      where: { orderId: In(orderIds) },
      order: { position: 'ASC', createdAt: 'ASC' },
    })

    for (const row of rows) {
      const list = grouped.get(row.orderId) ?? []
      list.push(this.toPayload(row))
      grouped.set(row.orderId, list)
    }

    return grouped
  }

  private async found(repository: Repository<OrderItemEntity>, orderId: string, itemId: string): Promise<OrderItemEntity> {
    const item = await repository.findOne({ where: { id: itemId, orderId } })

    if (!item) throw new NotFoundException('Service not found')

    return item
  }

  private fieldsOf(item: OrderItemEntity): IItemFields {
    return {
      kind: item.kind as ItemKind,
      title: item.title,
      supplierName: item.supplierName,
      serviceStart: item.serviceStart,
      serviceEnd: item.serviceEnd,
      priceAmount: item.priceAmount ?? '',
      priceCurrency: item.priceCurrency,
      requiredForConfirmation: item.requiredForConfirmation,
      note: typeof item.details?.note === 'string' ? item.details.note : '',
    }
  }

  private columnsOf(fields: IItemFields, details: Record<string, unknown> = {}) {
    const { note, ...columns } = fields
    const rest = { ...details }

    if (note) rest.note = note
    else delete rest.note

    return { ...columns, details: rest }
  }

  private async freeze(currency: string): Promise<{ fxRate: string | null, fxDate: string | null }> {
    if (!currency || currency === 'UZS') return { fxRate: '1', fxDate: today() }

    try {
      const current = await this.rates.current()
      const rate = rateFor(currency, current.rates)

      return rate ? { fxRate: String(rate), fxDate: current.date ?? today() } : { fxRate: null, fxDate: null }
    }
    catch {
      return { fxRate: null, fxDate: null }
    }
  }

  private toPayload(row: OrderItemEntity): IOrderItemPayload {
    const priceAmount = row.priceAmount === null ? null : Number(row.priceAmount)
    const fxRate = row.fxRate === null ? null : Number(row.fxRate)

    return {
      uuid: row.id,
      position: row.position,
      kind: row.kind,
      status: row.status,
      title: row.title,
      supplier_name: row.supplierName,
      supplier_ref: row.supplierRef,
      offer_id: row.offerId,
      service_start: row.serviceStart,
      service_end: row.serviceEnd,
      price_amount: priceAmount,
      price_currency: row.priceCurrency,
      price_uzs: itemUzs({ status: row.status, priceAmount, priceCurrency: row.priceCurrency, fxRate }),
      cost_amount: row.costAmount === null ? null : Number(row.costAmount),
      cost_currency: row.costCurrency,
      fx_rate: fxRate,
      fx_date: row.fxDate,
      agreed_rate: fxRate,
      required_for_confirmation: row.requiredForConfirmation,
      details: row.details ?? {},
    }
  }
}
