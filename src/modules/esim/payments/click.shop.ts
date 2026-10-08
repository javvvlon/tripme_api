import { createHash, timingSafeEqual } from 'node:crypto'
import { EsimPaymentMethod, PurchaseStatus } from '../esim.rules'
import type { IPayablePurchase, IPurchasePayments } from './purchase-payments.port'

export enum ClickError {
  Success = 0,
  SignFailed = -1,
  WrongAmount = -2,
  ActionNotFound = -3,
  AlreadyPaid = -4,
  OrderNotFound = -5,
  TransactionNotFound = -6,
  BadRequest = -8,
  TransactionCancelled = -9,
}

export enum ClickAction {
  Prepare = 0,
  Complete = 1,
}

export enum ClickState {
  Prepared = 1,
  Completed = 2,
  Cancelled = -1,
}

const NOTES: Record<ClickError, string> = {
  [ClickError.Success]: 'Success',
  [ClickError.SignFailed]: 'SIGN CHECK FAILED!',
  [ClickError.WrongAmount]: 'Incorrect parameter amount',
  [ClickError.ActionNotFound]: 'Action not found',
  [ClickError.AlreadyPaid]: 'Already paid',
  [ClickError.OrderNotFound]: 'Order not found',
  [ClickError.TransactionNotFound]: 'Transaction does not exist',
  [ClickError.BadRequest]: 'Error in request from click',
  [ClickError.TransactionCancelled]: 'Transaction cancelled',
}

const FIELDS = ['click_trans_id', 'service_id', 'click_paydoc_id', 'merchant_trans_id', 'amount', 'action', 'sign_time', 'sign_string']

const PAID = [PurchaseStatus.Paid, PurchaseStatus.Issued, PurchaseStatus.IssueFailed] as string[]

type Fields = Record<string, string>

export interface IClickPrepareAnswer {
  click_trans_id: number | null
  merchant_trans_id: string | null
  merchant_prepare_id: number | null
  error: ClickError
  error_note: string
}

export interface IClickCompleteAnswer {
  click_trans_id: number | null
  merchant_trans_id: string | null
  merchant_confirm_id: number | null
  error: ClickError
  error_note: string
}

const fieldsOf = (body: unknown): Fields | null => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null

  const fields: Fields = {}
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (typeof value === 'string' || typeof value === 'number') fields[key] = String(value)
  }

  return fields
}

const numberOrNull = (value: string | undefined): number | null => {
  const number = Number(value)

  return value !== undefined && value !== '' && Number.isFinite(number) ? number : null
}

const md5 = (value: string): string => createHash('md5').update(value, 'utf8').digest('hex')

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class ClickShopApi {
  constructor(
    private readonly port: IPurchasePayments,
    private readonly secretKey: string,
    private readonly serviceId: string,
    private readonly now: () => number = Date.now,
  ) {}

  async prepare(body: unknown): Promise<IClickPrepareAnswer> {
    const fields = fieldsOf(body)
    const answer = (error: ClickError, prepareId: number | null = null): IClickPrepareAnswer => ({
      click_trans_id: numberOrNull(fields?.click_trans_id),
      merchant_trans_id: fields?.merchant_trans_id ?? null,
      merchant_prepare_id: prepareId,
      error,
      error_note: NOTES[error],
    })

    if (!fields || FIELDS.some(key => !fields[key])) return answer(ClickError.BadRequest)
    if (!this.signed(fields, false)) return answer(ClickError.SignFailed)
    if (Number(fields.action) !== ClickAction.Prepare) return answer(ClickError.ActionNotFound)
    if (fields.service_id !== this.serviceId) return answer(ClickError.BadRequest)

    const purchase = await this.purchaseOf(fields)
    if (!purchase) return answer(ClickError.OrderNotFound)
    if (PAID.includes(purchase.status) || purchase.state === ClickState.Completed) return answer(ClickError.AlreadyPaid)
    if (!this.sameAmount(fields, purchase)) return answer(ClickError.WrongAmount)
    if (purchase.status !== PurchaseStatus.AwaitingPayment) return answer(ClickError.TransactionCancelled)

    await this.port.record(purchase.id, {
      txn: fields.click_trans_id,
      state: ClickState.Prepared,
      createdMs: this.now(),
      performedMs: null,
      cancelledMs: null,
      cancelReason: null,
    })

    return answer(ClickError.Success, purchase.number)
  }

  async complete(body: unknown): Promise<IClickCompleteAnswer> {
    const fields = fieldsOf(body)
    const answer = (error: ClickError, confirmId: number | null = null): IClickCompleteAnswer => ({
      click_trans_id: numberOrNull(fields?.click_trans_id),
      merchant_trans_id: fields?.merchant_trans_id ?? null,
      merchant_confirm_id: confirmId,
      error,
      error_note: NOTES[error],
    })

    if (!fields || [...FIELDS, 'merchant_prepare_id'].some(key => !fields[key])) return answer(ClickError.BadRequest)
    if (!this.signed(fields, true)) return answer(ClickError.SignFailed)
    if (Number(fields.action) !== ClickAction.Complete) return answer(ClickError.ActionNotFound)
    if (fields.service_id !== this.serviceId) return answer(ClickError.BadRequest)

    const purchase = await this.purchaseOf(fields)
    if (!purchase) return answer(ClickError.OrderNotFound)
    if (fields.merchant_prepare_id !== String(purchase.number) || purchase.txn !== fields.click_trans_id) {
      return answer(ClickError.TransactionNotFound)
    }
    if (PAID.includes(purchase.status) || purchase.state === ClickState.Completed) return answer(ClickError.AlreadyPaid)
    if (purchase.status !== PurchaseStatus.AwaitingPayment || purchase.state === ClickState.Cancelled) {
      return answer(ClickError.TransactionCancelled)
    }

    const clickError = Number(fields.error ?? 0)
    if (Number.isFinite(clickError) && clickError < 0) {
      await this.port.record(purchase.id, { state: ClickState.Cancelled, cancelledMs: this.now(), cancelReason: clickError })
      await this.port.markCancelled(purchase.id)

      return answer(ClickError.TransactionCancelled)
    }
    if (!this.sameAmount(fields, purchase)) return answer(ClickError.WrongAmount)

    const performedMs = this.now()
    await this.port.markPaid(purchase.id)
    await this.port.record(purchase.id, { state: ClickState.Completed, performedMs })

    return answer(ClickError.Success, purchase.number)
  }

  private signed(fields: Fields, complete: boolean): boolean {
    const source = [
      fields.click_trans_id,
      fields.service_id,
      this.secretKey,
      fields.merchant_trans_id,
      ...(complete ? [fields.merchant_prepare_id] : []),
      fields.amount,
      fields.action,
      fields.sign_time,
    ].join('')
    const expected = Buffer.from(md5(source), 'utf8')
    const given = Buffer.from(fields.sign_string.toLowerCase(), 'utf8')

    return Boolean(this.secretKey) && given.length === expected.length && timingSafeEqual(given, expected)
  }

  private async purchaseOf(fields: Fields): Promise<IPayablePurchase | null> {
    const number = Number(fields.merchant_trans_id)
    if (!Number.isSafeInteger(number) || number <= 0) return null

    const purchase = await this.port.byNumber(number)

    return purchase && purchase.method === EsimPaymentMethod.Click ? purchase : null
  }

  private sameAmount(fields: Fields, purchase: IPayablePurchase): boolean {
    const amount = Number(fields.amount)

    return Number.isFinite(amount) && Math.abs(amount - purchase.amountUzs) < 0.01
  }
}
