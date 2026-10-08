import { OrderStatus } from '../order.entity'
import type { OrderEntity } from '../order.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export enum ItemKind {
  Package = 'package',
  Flight = 'flight',
  Hotel = 'hotel',
  Transfer = 'transfer',
  Insurance = 'insurance',
  Excursion = 'excursion',
  Visa = 'visa',
}

export const ITEM_KINDS = Object.values(ItemKind)

export enum ItemStatus {
  Draft = 'draft',
  Requested = 'requested',
  Confirmed = 'confirmed',
  Rejected = 'rejected',
  Issued = 'issued',
  Cancelled = 'cancelled',
}

export interface IItemKindDefinition {
  kind: ItemKind
  tracked: boolean
  requiredForConfirmation: boolean
}

const tracked = (kind: ItemKind): IItemKindDefinition => ({ kind, tracked: true, requiredForConfirmation: true })
const logged = (kind: ItemKind): IItemKindDefinition => ({ kind, tracked: false, requiredForConfirmation: false })

export const ITEM_DEFINITIONS: Record<ItemKind, IItemKindDefinition> = {
  [ItemKind.Package]: tracked(ItemKind.Package),
  [ItemKind.Flight]: tracked(ItemKind.Flight),
  [ItemKind.Hotel]: tracked(ItemKind.Hotel),
  [ItemKind.Transfer]: logged(ItemKind.Transfer),
  [ItemKind.Insurance]: logged(ItemKind.Insurance),
  [ItemKind.Excursion]: logged(ItemKind.Excursion),
  [ItemKind.Visa]: logged(ItemKind.Visa),
}

export const isTracked = (kind: string): boolean => ITEM_DEFINITIONS[kind as ItemKind]?.tracked ?? false

const ITEM_STATUS_BY_ORDER: Record<OrderStatus, ItemStatus> = {
  [OrderStatus.Draft]: ItemStatus.Draft,
  [OrderStatus.Requested]: ItemStatus.Requested,
  [OrderStatus.Confirmed]: ItemStatus.Confirmed,
  [OrderStatus.Issued]: ItemStatus.Issued,
  [OrderStatus.Travelling]: ItemStatus.Issued,
  [OrderStatus.Completed]: ItemStatus.Issued,
  [OrderStatus.Cancelled]: ItemStatus.Cancelled,
}

export const itemStatusFor = (status: string): ItemStatus =>
  status === 'paid' ? ItemStatus.Confirmed : ITEM_STATUS_BY_ORDER[status as OrderStatus] ?? ItemStatus.Draft

const FINISHED_ORDER: string[] = [OrderStatus.Issued, OrderStatus.Travelling, OrderStatus.Completed]

export function followOrderStatus(current: string, orderStatus: string): ItemStatus {
  if (orderStatus === OrderStatus.Cancelled) return ItemStatus.Cancelled
  if (FINISHED_ORDER.includes(orderStatus)) return ItemStatus.Issued
  if (current === ItemStatus.Cancelled) return itemStatusFor(orderStatus)
  if (current === ItemStatus.Draft && orderStatus === OrderStatus.Requested) return ItemStatus.Requested
  if (current === ItemStatus.Issued) return ItemStatus.Confirmed

  return current as ItemStatus
}

export function followOrderForExtra(current: string, orderStatus: string, kind?: string): ItemStatus {
  if (orderStatus === OrderStatus.Cancelled) return INACTIVE_ITEM.includes(current) ? current as ItemStatus : ItemStatus.Cancelled
  if (kind !== undefined && !isTracked(kind)) return current as ItemStatus
  if (current === ItemStatus.Draft && orderStatus !== OrderStatus.Draft) return ItemStatus.Requested

  return current as ItemStatus
}

export const MANUAL_KINDS: ItemKind[] = ITEM_KINDS.filter(kind => kind !== ItemKind.Package)

export const CONFIRMED_ITEM: string[] = [ItemStatus.Confirmed, ItemStatus.Issued]

export const INACTIVE_ITEM: string[] = [ItemStatus.Cancelled, ItemStatus.Rejected]

export interface IPackageItemFields {
  kind: ItemKind
  position: number
  status: ItemStatus
  title: string
  supplierName: string
  supplierRef: string
  offerId: string
  serviceStart: string | null
  serviceEnd: string | null
  priceAmount: string | null
  priceCurrency: string
  requiredForConfirmation: boolean
  details: Record<string, unknown>
}

const PACKAGE_TRIP_KEYS = [
  'hotel_stars', 'hotel_code', 'meal_name', 'room_name', 'district',
  'programme', 'fare', 'booking_url', 'hotel_url', 'route_from', 'route_to', 'kid_ages',
] as const

const endOf = (order: Pick<OrderEntity, 'returnDate' | 'checkIn' | 'nights'>): string | null => {
  if (order.returnDate) return order.returnDate
  if (!order.checkIn) return null

  const at = new Date(`${order.checkIn}T00:00:00Z`)

  at.setUTCDate(at.getUTCDate() + (order.nights || 0))

  return at.toISOString().slice(0, 10)
}

export function packageFromOrder(order: OrderEntity): IPackageItemFields {
  const trip = order.trip ?? {}
  const details: Record<string, unknown> = {
    nights: order.nights,
    adults: order.adults,
    children: order.children,
    country: order.country ?? '',
  }

  for (const key of PACKAGE_TRIP_KEYS) {
    if (trip[key] !== undefined && trip[key] !== null && trip[key] !== '') details[key] = trip[key]
  }

  return {
    kind: ItemKind.Package,
    position: 0,
    status: itemStatusFor(order.status),
    title: order.hotelName ?? '',
    supplierName: order.supplierName ?? '',
    supplierRef: order.supplierOrderId ?? '',
    offerId: typeof trip.offer_id === 'string' ? trip.offer_id : String(trip.offer_id ?? ''),
    serviceStart: order.checkIn,
    serviceEnd: endOf(order),
    priceAmount: order.priceAmount,
    priceCurrency: order.priceCurrency ?? '',
    requiredForConfirmation: ITEM_DEFINITIONS[ItemKind.Package].requiredForConfirmation,
    details,
  }
}
