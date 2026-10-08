import { describe, expect, it } from 'vitest'
import { OrderStatus } from '../order.entity'
import type { OrderEntity } from '../order.entity'
import { ITEM_DEFINITIONS, ITEM_KINDS, ItemKind, ItemStatus, followOrderStatus, itemStatusFor, packageFromOrder } from './item-kinds'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const order = (patch: Partial<OrderEntity> = {}): OrderEntity => ({
  id: 'o1',
  status: OrderStatus.Requested,
  hotelName: 'ELAN HOTEL TAKSIM 3*',
  supplierName: 'EasyBooking',
  supplierOrderId: 'EB-1',
  checkIn: '2026-10-26',
  returnDate: null,
  nights: 7,
  adults: 2,
  children: 1,
  country: 'turkey',
  priceAmount: '1132',
  priceCurrency: 'USD',
  trip: { offer_id: 'of-9', meal_name: 'BB', room_name: '', hotel_stars: 3, kid_ages: [5] },
  ...patch,
} as OrderEntity)

describe('order item kinds', () => {
  it('defines every kind', () => {
    expect(ITEM_KINDS.every(kind => ITEM_DEFINITIONS[kind].kind === kind)).toBe(true)
  })

  it('maps order statuses onto the item lifecycle', () => {
    expect(itemStatusFor(OrderStatus.Draft)).toBe(ItemStatus.Draft)
    expect(itemStatusFor('paid')).toBe(ItemStatus.Confirmed)
    expect(itemStatusFor(OrderStatus.Travelling)).toBe(ItemStatus.Issued)
    expect(itemStatusFor(OrderStatus.Cancelled)).toBe(ItemStatus.Cancelled)
    expect(itemStatusFor('unknown')).toBe(ItemStatus.Draft)
  })

  it('builds the package item from the order', () => {
    const item = packageFromOrder(order())

    expect(item).toMatchObject({
      kind: ItemKind.Package,
      status: ItemStatus.Requested,
      title: 'ELAN HOTEL TAKSIM 3*',
      supplierName: 'EasyBooking',
      supplierRef: 'EB-1',
      offerId: 'of-9',
      serviceStart: '2026-10-26',
      serviceEnd: '2026-11-02',
      priceAmount: '1132',
      priceCurrency: 'USD',
      requiredForConfirmation: true,
    })
    expect(item.details).toEqual({ nights: 7, adults: 2, children: 1, country: 'turkey', meal_name: 'BB', hotel_stars: 3, kid_ages: [5] })
  })

  it('keeps supplier confirmation separate from the order status', () => {
    expect(followOrderStatus(ItemStatus.Draft, OrderStatus.Requested)).toBe(ItemStatus.Requested)
    expect(followOrderStatus(ItemStatus.Requested, OrderStatus.Confirmed)).toBe(ItemStatus.Requested)
    expect(followOrderStatus(ItemStatus.Confirmed, OrderStatus.Requested)).toBe(ItemStatus.Confirmed)
    expect(followOrderStatus(ItemStatus.Confirmed, OrderStatus.Issued)).toBe(ItemStatus.Issued)
    expect(followOrderStatus(ItemStatus.Confirmed, OrderStatus.Cancelled)).toBe(ItemStatus.Cancelled)
    expect(followOrderStatus(ItemStatus.Rejected, OrderStatus.Requested)).toBe(ItemStatus.Rejected)
  })

  it('prefers the stored return date and copes with a missing check-in', () => {
    expect(packageFromOrder(order({ returnDate: '2026-11-05' })).serviceEnd).toBe('2026-11-05')
    expect(packageFromOrder(order({ checkIn: null })).serviceEnd).toBeNull()
  })
})
