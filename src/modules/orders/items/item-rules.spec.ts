import { describe, expect, it } from 'vitest'
import { OrderStatus } from '../order.entity'
import { ItemKind, ItemStatus, MANUAL_KINDS, followOrderForExtra } from './item-kinds'
import { assertEditable, assertIssuable, assertOrderTakesServices, firstStatusFor, itemFieldsOf, removalOf } from './item-rules'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const insurance = {
  kind: 'insurance',
  title: 'Страховка Kafolat, 2 туриста',
  supplier_name: 'Kafolat',
  service_start: '2026-11-04',
  service_end: '2026-11-14',
  price_amount: '18,50',
  price_currency: 'usd',
}

describe('manual order services', () => {
  it('never offers the package or eSIM as a manual service', () => {
    expect(MANUAL_KINDS).not.toContain(ItemKind.Package)
    expect(MANUAL_KINDS).not.toContain('esim')
    expect(MANUAL_KINDS).toContain(ItemKind.Insurance)
  })

  it('reads a service from the form', () => {
    expect(itemFieldsOf(insurance)).toEqual({
      kind: ItemKind.Insurance,
      title: 'Страховка Kafolat, 2 туриста',
      supplierName: 'Kafolat',
      serviceStart: '2026-11-04',
      serviceEnd: '2026-11-14',
      priceAmount: '18.5',
      priceCurrency: 'USD',
      requiredForConfirmation: false,
      note: '',
    })
  })

  it('asks suppliers to confirm only flights and hotels', () => {
    expect(itemFieldsOf({ ...insurance, kind: 'flight' }).requiredForConfirmation).toBe(true)
    expect(itemFieldsOf({ ...insurance, kind: 'hotel' }).requiredForConfirmation).toBe(true)
    expect(itemFieldsOf({ ...insurance, kind: 'visa' }).requiredForConfirmation).toBe(false)
  })

  it('refuses a service it cannot price or place', () => {
    expect(() => itemFieldsOf({ ...insurance, kind: 'package' })).toThrow('Unknown service kind')
    expect(() => itemFieldsOf({ ...insurance, title: '  ' })).toThrow('needs a name')
    expect(() => itemFieldsOf({ ...insurance, price_amount: 0 })).toThrow('above zero')
    expect(() => itemFieldsOf({ ...insurance, price_amount: undefined })).toThrow('above zero')
    expect(() => itemFieldsOf({ ...insurance, price_currency: 'RUB' })).toThrow('UZS, USD or EUR')
    expect(() => itemFieldsOf({ ...insurance, service_end: '2026-11-01' })).toThrow('end before it starts')
    expect(() => itemFieldsOf({ ...insurance, service_start: '04.11.2026' })).toThrow('2026-10-26')
  })

  it('keeps what an edit does not touch', () => {
    const current = itemFieldsOf(insurance)

    expect(itemFieldsOf({ price_amount: 25 }, current)).toEqual({ ...current, priceAmount: '25' })
    expect(itemFieldsOf({ service_end: null }, current).serviceEnd).toBeNull()
  })

  it('opens tracked services in step with the order, and logs the rest as done', () => {
    expect(firstStatusFor(OrderStatus.Draft, 'flight')).toBe(ItemStatus.Draft)
    expect(firstStatusFor(OrderStatus.Confirmed, 'hotel')).toBe(ItemStatus.Requested)
    expect(firstStatusFor(OrderStatus.Draft, 'visa')).toBe(ItemStatus.Confirmed)
    expect(() => assertOrderTakesServices(OrderStatus.Cancelled)).toThrow('closed order')
    expect(() => assertOrderTakesServices(OrderStatus.Completed)).toThrow('closed order')
    expect(() => assertOrderTakesServices(OrderStatus.Issued)).not.toThrow()
  })

  it('deletes a logged service, and cancels a booking a supplier confirmed', () => {
    expect(removalOf({ kind: 'flight', status: 'requested' })).toBe('delete')
    expect(removalOf({ kind: 'hotel', status: 'confirmed' })).toBe('cancel')
    expect(removalOf({ kind: 'flight', status: 'issued' })).toBe('cancel')
    expect(removalOf({ kind: 'visa', status: 'confirmed' })).toBe('delete')
    expect(() => removalOf({ kind: 'package', status: 'draft' })).toThrow('tour package')
    expect(() => removalOf({ kind: 'visa', status: 'cancelled' })).toThrow('already cancelled')
  })

  it('locks the package, issued and cancelled services', () => {
    expect(() => assertEditable({ kind: 'package', status: 'draft' })).toThrow('tour package')
    expect(() => assertEditable({ kind: 'insurance', status: 'issued' })).toThrow('issued')
    expect(() => assertEditable({ kind: 'insurance', status: 'cancelled' })).toThrow('cancelled')
    expect(() => assertEditable({ kind: 'insurance', status: 'confirmed' })).not.toThrow()
    expect(() => assertIssuable({ kind: 'flight', status: 'issued' })).toThrow('already issued')
    expect(() => assertIssuable({ kind: 'flight', status: 'requested' })).not.toThrow()
    expect(() => assertIssuable({ kind: 'visa', status: 'confirmed' })).toThrow('no issuing step')
  })

  it('follows the order only where it must', () => {
    expect(followOrderForExtra(ItemStatus.Draft, OrderStatus.Requested)).toBe(ItemStatus.Requested)
    expect(followOrderForExtra(ItemStatus.Confirmed, OrderStatus.Cancelled)).toBe(ItemStatus.Cancelled)
    expect(followOrderForExtra(ItemStatus.Rejected, OrderStatus.Cancelled)).toBe(ItemStatus.Rejected)
    expect(followOrderForExtra(ItemStatus.Requested, OrderStatus.Issued)).toBe(ItemStatus.Requested)
    expect(followOrderForExtra(ItemStatus.Issued, OrderStatus.Confirmed)).toBe(ItemStatus.Issued)
    expect(followOrderForExtra(ItemStatus.Confirmed, OrderStatus.Requested, 'visa')).toBe(ItemStatus.Confirmed)
    expect(followOrderForExtra(ItemStatus.Confirmed, OrderStatus.Cancelled, 'visa')).toBe(ItemStatus.Cancelled)
  })
})
