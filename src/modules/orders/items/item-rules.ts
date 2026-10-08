import { BadRequestException, ConflictException } from '@nestjs/common'
import { PAYMENT_CURRENCIES } from '~/modules/finance/finance.rules'
import { OrderStatus } from '../order.entity'
import { CONFIRMED_ITEM, INACTIVE_ITEM, ITEM_DEFINITIONS, ItemKind, ItemStatus, MANUAL_KINDS, isTracked } from './item-kinds'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IOrderItemInput {
  kind?: string
  title?: string
  supplier_name?: string
  service_start?: string | null
  service_end?: string | null
  price_amount?: number | string | null
  price_currency?: string
  note?: string
}

export interface IItemFields {
  kind: ItemKind
  title: string
  supplierName: string
  serviceStart: string | null
  serviceEnd: string | null
  priceAmount: string
  priceCurrency: string
  requiredForConfirmation: boolean
  note: string
}

export interface IItemState {
  kind: string
  status: string
}

const CLOSED_ORDERS: string[] = [OrderStatus.Cancelled, OrderStatus.Completed]

const text = (value: unknown, limit: number): string =>
  typeof value === 'string' ? value.trim().slice(0, limit) : ''

const day = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw new BadRequestException('Dates must look like 2026-10-26')

  return String(value)
}

const amountOf = (value: unknown): string => {
  const amount = Number(typeof value === 'string' ? value.replace(/\s/g, '').replace(',', '.') : value)

  if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('The service needs a price above zero')

  return String(Math.round(amount * 100) / 100)
}

export function itemFieldsOf(input: IOrderItemInput, current?: IItemFields): IItemFields {
  const kind = (input.kind ?? current?.kind) as ItemKind

  if (!MANUAL_KINDS.includes(kind)) throw new BadRequestException('Unknown service kind')

  const title = input.title !== undefined ? text(input.title, 240) : current?.title ?? ''

  if (!title) throw new BadRequestException('The service needs a name')

  const currency = input.price_currency !== undefined ? text(input.price_currency, 8).toUpperCase() : current?.priceCurrency ?? ''

  if (!PAYMENT_CURRENCIES.includes(currency as never)) throw new BadRequestException('The currency must be UZS, USD or EUR')

  const serviceStart = input.service_start !== undefined ? day(input.service_start) : current?.serviceStart ?? null
  const serviceEnd = input.service_end !== undefined ? day(input.service_end) : current?.serviceEnd ?? null

  if (serviceStart && serviceEnd && serviceEnd < serviceStart) {
    throw new BadRequestException('The service cannot end before it starts')
  }

  return {
    kind,
    title,
    supplierName: input.supplier_name !== undefined ? text(input.supplier_name, 120) : current?.supplierName ?? '',
    serviceStart,
    serviceEnd,
    priceAmount: input.price_amount !== undefined ? amountOf(input.price_amount) : current?.priceAmount ?? amountOf(null),
    priceCurrency: currency,
    requiredForConfirmation: ITEM_DEFINITIONS[kind].requiredForConfirmation,
    note: input.note !== undefined ? text(input.note, 1000) : current?.note ?? '',
  }
}

export function assertOrderTakesServices(orderStatus: string): void {
  if (CLOSED_ORDERS.includes(orderStatus)) throw new ConflictException('A closed order cannot take new services')
}

export function firstStatusFor(orderStatus: string, kind: string): ItemStatus {
  if (!isTracked(kind)) return ItemStatus.Confirmed

  return orderStatus === OrderStatus.Draft ? ItemStatus.Draft : ItemStatus.Requested
}

export function assertEditable(item: IItemState): void {
  if (item.kind === ItemKind.Package) throw new ConflictException('The tour package follows the order details')
  if (INACTIVE_ITEM.includes(item.status)) throw new ConflictException('A cancelled service cannot be changed')
  if (item.status === ItemStatus.Issued) throw new ConflictException('An issued service cannot be changed')
}

export type ItemRemoval = 'delete' | 'cancel'

export function removalOf(item: IItemState): ItemRemoval {
  if (item.kind === ItemKind.Package) throw new ConflictException('The tour package follows the order details')
  if (INACTIVE_ITEM.includes(item.status)) throw new ConflictException('This service is already cancelled')
  if (!isTracked(item.kind)) return 'delete'

  return CONFIRMED_ITEM.includes(item.status) ? 'cancel' : 'delete'
}

export function assertIssuable(item: IItemState): void {
  if (item.kind === ItemKind.Package) throw new ConflictException('The tour package is issued with the order')
  if (!isTracked(item.kind)) throw new ConflictException('This service has no issuing step')
  if (INACTIVE_ITEM.includes(item.status)) throw new ConflictException('A cancelled service cannot be issued')
  if (item.status === ItemStatus.Issued) throw new ConflictException('This service is already issued')
}
