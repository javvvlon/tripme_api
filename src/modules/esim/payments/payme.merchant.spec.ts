import { beforeEach, describe, expect, it } from 'vitest'
import { EsimPaymentMethod, PAYMENT_WINDOW_MS, PurchaseStatus } from '../esim.rules'
import { PaymeMerchantApi } from './payme.merchant'
import type { IPayablePurchase, IPaymentStatePatch, IPurchasePayments } from './purchase-payments.port'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
class FakePort implements IPurchasePayments {
  readonly purchases: IPayablePurchase[] = []
  readonly paid: string[] = []
  readonly cancelled: string[] = []

  add(number: number, amountUzs: number, createdAt: Date, patch: Partial<IPayablePurchase> = {}): IPayablePurchase {
    const purchase: IPayablePurchase = {
      id: `p${number}`,
      number,
      status: PurchaseStatus.AwaitingPayment,
      method: EsimPaymentMethod.Payme,
      amountUzs,
      createdAt,
      txn: null,
      state: null,
      createdMs: null,
      performedMs: null,
      cancelledMs: null,
      cancelReason: null,
      ...patch,
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

  async between(fromMs: number, toMs: number, method: string) {
    return this.purchases.filter(purchase => purchase.method === method
      && purchase.createdMs !== null && purchase.createdMs >= fromMs && purchase.createdMs <= toMs)
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

const KEY = 'secret-key'
const AUTH = `Basic ${Buffer.from(`Paycom:${KEY}`).toString('base64')}`
const START = 1_760_000_000_000

let port: FakePort
let clock: number
let api: PaymeMerchantApi

const call = (method: string, params: Record<string, unknown>, authorization: string | undefined = AUTH) =>
  api.handle(authorization, { jsonrpc: '2.0', id: 7, method, params })

const codeOf = (response: Record<string, unknown>): number => (response.error as { code: number }).code

const create = (id: string, order: number | string = 1001, amount = 15_000_000) =>
  call('CreateTransaction', { id, time: clock, amount, account: { order } })

beforeEach(() => {
  port = new FakePort()
  clock = START
  api = new PaymeMerchantApi(port, KEY, () => clock)
  port.add(1001, 150_000, new Date(START - 60_000))
  port.add(1002, 90_000, new Date(START - 60_000))
})

describe('PaymeMerchantApi', () => {
  it('rejects a request with a wrong or missing authorization', async () => {
    const wrong = `Basic ${Buffer.from('Paycom:nope').toString('base64')}`

    expect(codeOf(await call('CheckPerformTransaction', {}, wrong))).toBe(-32504)
    expect(codeOf(await api.handle(undefined, { id: 7, method: 'CheckPerformTransaction', params: {} }))).toBe(-32504)
  })

  it('answers malformed requests and unknown methods with the JSON-RPC codes', async () => {
    expect(codeOf(await api.handle(AUTH, 'nonsense'))).toBe(-32600)
    expect(codeOf(await call('ChangePassword', {}))).toBe(-32601)
  })

  it('allows paying an awaiting order with the exact amount in tiyin', async () => {
    const response = await call('CheckPerformTransaction', { amount: 15_000_000, account: { order: '1001' } })

    expect(response).toEqual({ result: { allow: true }, id: 7 })
  })

  it('refuses a wrong amount', async () => {
    expect(codeOf(await call('CheckPerformTransaction', { amount: 150_000, account: { order: 1001 } }))).toBe(-31001)
  })

  it('refuses an unknown, foreign or stale order', async () => {
    expect(await call('CheckPerformTransaction', { amount: 100, account: { order: 9999 } })).toMatchObject({
      error: { code: -31050, data: 'order', message: { ru: expect.any(String), uz: expect.any(String), en: expect.any(String) } },
      id: 7,
    })
    port.add(1003, 1000, new Date(START), { method: EsimPaymentMethod.Click })
    expect(codeOf(await call('CheckPerformTransaction', { amount: 100_000, account: { order: 1003 } }))).toBe(-31050)
    port.add(1004, 1000, new Date(START - PAYMENT_WINDOW_MS - 1))
    expect(codeOf(await call('CheckPerformTransaction', { amount: 100_000, account: { order: 1004 } }))).toBe(-31051)
  })

  it('creates a transaction once and answers repeats with the same data', async () => {
    const first = await create('tx-1')
    clock += 5_000
    const again = await create('tx-1')

    expect(first).toEqual({ result: { create_time: START, transaction: '1001', state: 1 }, id: 7 })
    expect(again).toEqual(first)
  })

  it('refuses a second transaction on an order that is already being paid', async () => {
    await create('tx-1')

    expect(codeOf(await create('tx-2'))).toBe(-31052)
    expect(codeOf(await call('CheckPerformTransaction', { amount: 15_000_000, account: { order: 1001 } }))).toBe(-31052)
  })

  it('cancels a created transaction that outlived the timeout', async () => {
    await create('tx-1')
    clock += PAYMENT_WINDOW_MS + 1

    expect(codeOf(await create('tx-1'))).toBe(-31008)
    expect(port.purchases[0]).toMatchObject({ state: -1, cancelReason: 4, cancelledMs: clock })
    expect(port.cancelled).toEqual(['p1001'])
  })

  it('performs a transaction and pays the purchase exactly once', async () => {
    await create('tx-1')
    clock += 1_000
    const performed = await call('PerformTransaction', { id: 'tx-1' })
    clock += 1_000
    const repeated = await call('PerformTransaction', { id: 'tx-1' })

    expect(performed).toEqual({ result: { transaction: '1001', perform_time: START + 1_000, state: 2 }, id: 7 })
    expect(repeated).toEqual(performed)
    expect(port.paid).toEqual(['p1001'])
  })

  it('does not know an unknown transaction', async () => {
    expect(codeOf(await call('PerformTransaction', { id: 'missing' }))).toBe(-31003)
    expect(codeOf(await call('CheckTransaction', { id: 'missing' }))).toBe(-31003)
  })

  it('cancels a transaction before perform and the purchase with it', async () => {
    await create('tx-1')
    clock += 1_000
    const cancelled = await call('CancelTransaction', { id: 'tx-1', reason: 3 })
    const repeated = await call('CancelTransaction', { id: 'tx-1', reason: 3 })

    expect(cancelled).toEqual({ result: { transaction: '1001', cancel_time: START + 1_000, state: -1 }, id: 7 })
    expect(repeated).toEqual(cancelled)
    expect(port.cancelled).toEqual(['p1001'])
    expect(codeOf(await call('PerformTransaction', { id: 'tx-1' }))).toBe(-31008)
  })

  it('refuses to cancel a performed transaction because the eSIM is delivered', async () => {
    await create('tx-1')
    await call('PerformTransaction', { id: 'tx-1' })

    expect(codeOf(await call('CancelTransaction', { id: 'tx-1', reason: 5 }))).toBe(-31007)
    expect(port.cancelled).toEqual([])
  })

  it('reports a transaction in the CheckTransaction shape', async () => {
    await create('tx-1')

    expect(await call('CheckTransaction', { id: 'tx-1' })).toEqual({
      result: { create_time: START, perform_time: 0, cancel_time: 0, transaction: '1001', state: 1, reason: null },
      id: 7,
    })

    clock += 2_000
    await call('CancelTransaction', { id: 'tx-1', reason: 3 })

    expect(await call('CheckTransaction', { id: 'tx-1' })).toEqual({
      result: { create_time: START, perform_time: 0, cancel_time: START + 2_000, transaction: '1001', state: -1, reason: 3 },
      id: 7,
    })
  })

  it('lists the transactions of a period in the statement', async () => {
    await create('tx-1')
    clock += 1_000
    await create('tx-2', 1002, 9_000_000)
    await call('PerformTransaction', { id: 'tx-2' })

    const response = await call('GetStatement', { from: START, to: START + 10_000 })

    expect(response).toEqual({
      result: {
        transactions: [
          {
            id: 'tx-1',
            time: START,
            amount: 15_000_000,
            account: { order: '1001' },
            create_time: START,
            perform_time: 0,
            cancel_time: 0,
            transaction: '1001',
            state: 1,
            reason: null,
          },
          {
            id: 'tx-2',
            time: START + 1_000,
            amount: 9_000_000,
            account: { order: '1002' },
            create_time: START + 1_000,
            perform_time: START + 1_000,
            cancel_time: 0,
            transaction: '1002',
            state: 2,
            reason: null,
          },
        ],
      },
      id: 7,
    })
  })
})
