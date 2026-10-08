import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { EsimPaymentMethod, PurchaseStatus } from '../esim.rules'
import { ClickShopApi } from './click.shop'
import type { IPayablePurchase, IPaymentStatePatch, IPurchasePayments } from './purchase-payments.port'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
class FakePort implements IPurchasePayments {
  readonly purchases: IPayablePurchase[] = []
  readonly paid: string[] = []
  readonly cancelled: string[] = []

  add(number: number, amountUzs: number): IPayablePurchase {
    const purchase: IPayablePurchase = {
      id: `p${number}`,
      number,
      status: PurchaseStatus.AwaitingPayment,
      method: EsimPaymentMethod.Click,
      amountUzs,
      createdAt: new Date(),
      txn: null,
      state: null,
      createdMs: null,
      performedMs: null,
      cancelledMs: null,
      cancelReason: null,
    }
    this.purchases.push(purchase)

    return purchase
  }

  async byNumber(number: number) {
    return this.purchases.find(purchase => purchase.number === number) ?? null
  }

  async byTxn(txn: string) {
    return this.purchases.find(purchase => purchase.txn === txn) ?? null
  }

  async between() {
    return []
  }

  async record(id: string, patch: IPaymentStatePatch) {
    Object.assign(this.purchases.find(purchase => purchase.id === id)!, patch)
  }

  async markPaid(id: string) {
    this.paid.push(id)
    this.purchases.find(purchase => purchase.id === id)!.status = PurchaseStatus.Paid
  }

  async markCancelled(id: string) {
    this.cancelled.push(id)
    this.purchases.find(purchase => purchase.id === id)!.status = PurchaseStatus.Cancelled
  }
}

const SECRET = 'click-secret'
const SERVICE = '12345'
const SIGN_TIME = '2026-10-08 12:00:00'

const md5 = (value: string): string => createHash('md5').update(value).digest('hex')

const prepareBody = (patch: Record<string, string> = {}) => {
  const body: Record<string, string> = {
    click_trans_id: '555',
    service_id: SERVICE,
    click_paydoc_id: '777',
    merchant_trans_id: '1001',
    amount: '150000.00',
    action: '0',
    error: '0',
    error_note: 'Success',
    sign_time: SIGN_TIME,
    ...patch,
  }
  body.sign_string = md5(`${body.click_trans_id}${body.service_id}${SECRET}${body.merchant_trans_id}${body.amount}${body.action}${body.sign_time}`)

  return body
}

const completeBody = (patch: Record<string, string> = {}) => {
  const body: Record<string, string> = {
    click_trans_id: '555',
    service_id: SERVICE,
    click_paydoc_id: '777',
    merchant_trans_id: '1001',
    merchant_prepare_id: '1001',
    amount: '150000.00',
    action: '1',
    error: '0',
    error_note: 'Success',
    sign_time: SIGN_TIME,
    ...patch,
  }
  body.sign_string = md5(`${body.click_trans_id}${body.service_id}${SECRET}${body.merchant_trans_id}${body.merchant_prepare_id}${body.amount}${body.action}${body.sign_time}`)

  return body
}

let port: FakePort
let api: ClickShopApi

beforeEach(() => {
  port = new FakePort()
  api = new ClickShopApi(port, SECRET, SERVICE, () => 1_000)
  port.add(1001, 150_000)
})

describe('ClickShopApi', () => {
  it('rejects a forged signature', async () => {
    const answer = await api.prepare({ ...prepareBody(), amount: '1.00' })

    expect(answer).toMatchObject({ error: -1, error_note: 'SIGN CHECK FAILED!' })
    expect(port.purchases[0].txn).toBeNull()
  })

  it('rejects a request with missing fields', async () => {
    expect((await api.prepare({ click_trans_id: '555' })).error).toBe(-8)
  })

  it('rejects a wrong amount', async () => {
    expect((await api.prepare(prepareBody({ amount: '149000.00' }))).error).toBe(-2)
  })

  it('rejects an unknown order', async () => {
    expect((await api.prepare(prepareBody({ merchant_trans_id: '9999' }))).error).toBe(-5)
  })

  it('prepares a payment and records the click transaction', async () => {
    const answer = await api.prepare(prepareBody())

    expect(answer).toEqual({
      click_trans_id: 555,
      merchant_trans_id: '1001',
      merchant_prepare_id: 1001,
      error: 0,
      error_note: 'Success',
    })
    expect(port.purchases[0]).toMatchObject({ txn: '555', state: 1, createdMs: 1_000 })
  })

  it('completes a prepared payment and pays the purchase', async () => {
    await api.prepare(prepareBody())
    const answer = await api.complete(completeBody())

    expect(answer).toEqual({
      click_trans_id: 555,
      merchant_trans_id: '1001',
      merchant_confirm_id: 1001,
      error: 0,
      error_note: 'Success',
    })
    expect(port.paid).toEqual(['p1001'])
    expect(port.purchases[0]).toMatchObject({ state: 2, performedMs: 1_000 })
  })

  it('answers already paid on a repeated completion', async () => {
    await api.prepare(prepareBody())
    await api.complete(completeBody())

    expect((await api.complete(completeBody())).error).toBe(-4)
    expect((await api.prepare(prepareBody())).error).toBe(-4)
    expect(port.paid).toEqual(['p1001'])
  })

  it('refuses to complete an unknown click transaction', async () => {
    await api.prepare(prepareBody())

    expect((await api.complete(completeBody({ click_trans_id: '556' }))).error).toBe(-6)
  })

  it('cancels the purchase when click reports a failed payment', async () => {
    await api.prepare(prepareBody())
    const answer = await api.complete(completeBody({ error: '-5017', error_note: 'Insufficient funds' }))

    expect(answer).toMatchObject({ error: -9, merchant_confirm_id: null })
    expect(port.cancelled).toEqual(['p1001'])
    expect(port.paid).toEqual([])
    expect(port.purchases[0]).toMatchObject({ state: -1, cancelReason: -5017 })
    expect((await api.complete(completeBody())).error).toBe(-9)
  })
})
