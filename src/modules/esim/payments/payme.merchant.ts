import { timingSafeEqual } from 'node:crypto'
import { EsimPaymentMethod, PAYMENT_WINDOW_MS, PurchaseStatus } from '../esim.rules'
import type { IPayablePurchase, IPurchasePayments } from './purchase-payments.port'

export enum PaymeState {
  Created = 1,
  Performed = 2,
  CancelledBeforePerform = -1,
  CancelledAfterPerform = -2,
}

export enum PaymeError {
  Internal = -32400,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  Unauthorized = -32504,
  WrongAmount = -31001,
  TransactionNotFound = -31003,
  CannotCancel = -31007,
  CannotPerform = -31008,
  OrderNotFound = -31050,
  OrderNotPayable = -31051,
  OrderBusy = -31052,
}

export const PAYME_TIMEOUT_REASON = 4

export const PAYME_TIMEOUT_MS = PAYMENT_WINDOW_MS

interface IPaymeMessage {
  ru: string
  uz: string
  en: string
}

const MESSAGES: Record<PaymeError, IPaymeMessage> = {
  [PaymeError.Internal]: { ru: 'Системная ошибка', uz: 'Tizim xatosi', en: 'System error' },
  [PaymeError.InvalidRequest]: { ru: 'Неверный RPC-запрос', uz: 'Noto‘g‘ri RPC so‘rov', en: 'Invalid RPC request' },
  [PaymeError.MethodNotFound]: { ru: 'Метод не найден', uz: 'Usul topilmadi', en: 'Method not found' },
  [PaymeError.Unauthorized]: {
    ru: 'Недостаточно привилегий для выполнения метода',
    uz: 'Usulni bajarish uchun huquqlar yetarli emas',
    en: 'Insufficient privileges to perform the method',
  },
  [PaymeError.WrongAmount]: { ru: 'Неверная сумма', uz: 'Noto‘g‘ri summa', en: 'Incorrect amount' },
  [PaymeError.TransactionNotFound]: { ru: 'Транзакция не найдена', uz: 'Tranzaksiya topilmadi', en: 'Transaction not found' },
  [PaymeError.CannotCancel]: {
    ru: 'Невозможно отменить транзакцию: eSIM уже выдана',
    uz: 'Tranzaksiyani bekor qilib bo‘lmaydi: eSIM allaqachon berilgan',
    en: 'The transaction cannot be cancelled: the eSIM has been delivered',
  },
  [PaymeError.CannotPerform]: {
    ru: 'Невозможно выполнить данную операцию',
    uz: 'Ushbu amalni bajarib bo‘lmaydi',
    en: 'Unable to perform this operation',
  },
  [PaymeError.OrderNotFound]: { ru: 'Заказ не найден', uz: 'Buyurtma topilmadi', en: 'Order not found' },
  [PaymeError.OrderNotPayable]: {
    ru: 'Заказ не ожидает оплаты',
    uz: 'Buyurtma to‘lovni kutmayapti',
    en: 'The order is not awaiting payment',
  },
  [PaymeError.OrderBusy]: {
    ru: 'Заказ уже оплачивается другой транзакцией',
    uz: 'Buyurtma boshqa tranzaksiya orqali to‘lanmoqda',
    en: 'The order is being paid by another transaction',
  },
}

class PaymeFault extends Error {
  constructor(readonly code: PaymeError, readonly data?: string) {
    super(MESSAGES[code].en)
  }
}

type Params = Record<string, unknown>

const isObject = (value: unknown): value is Params =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const requireString = (params: Params, key: string): string => {
  const value = params[key]
  if (typeof value !== 'string' || !value) throw new PaymeFault(PaymeError.InvalidRequest, key)

  return value
}

const requireNumber = (params: Params, key: string): number => {
  const value = params[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new PaymeFault(PaymeError.InvalidRequest, key)

  return value
}

const tiyinOf = (purchase: IPayablePurchase): number => Math.round(purchase.amountUzs * 100)

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class PaymeMerchantApi {
  constructor(
    private readonly port: IPurchasePayments,
    private readonly key: string,
    private readonly now: () => number = Date.now,
  ) {}

  async handle(authorization: string | undefined, body: unknown): Promise<Record<string, unknown>> {
    const id = isObject(body) && body.id !== undefined ? body.id : null

    try {
      if (!this.authorized(authorization)) throw new PaymeFault(PaymeError.Unauthorized)
      if (!isObject(body) || typeof body.method !== 'string') throw new PaymeFault(PaymeError.InvalidRequest)

      const params = body.params === undefined ? {} : body.params
      if (!isObject(params)) throw new PaymeFault(PaymeError.InvalidRequest, 'params')

      return { result: await this.dispatch(body.method, params), id }
    }
    catch (error) {
      const fault = error instanceof PaymeFault ? error : new PaymeFault(PaymeError.Internal)

      return {
        error: {
          code: fault.code,
          message: MESSAGES[fault.code],
          ...(fault.data === undefined ? {} : { data: fault.data }),
        },
        id,
      }
    }
  }

  private authorized(authorization: string | undefined): boolean {
    if (!this.key || !authorization) return false

    const [scheme, encoded] = authorization.trim().split(/\s+/)
    if (scheme?.toLowerCase() !== 'basic' || !encoded) return false

    const expected = Buffer.from(`Paycom:${this.key}`, 'utf8')
    const given = Buffer.from(Buffer.from(encoded, 'base64').toString('utf8'), 'utf8')

    return given.length === expected.length && timingSafeEqual(given, expected)
  }

  private dispatch(method: string, params: Params): Promise<Record<string, unknown>> {
    switch (method) {
      case 'CheckPerformTransaction': return this.checkPerform(params)
      case 'CreateTransaction': return this.create(params)
      case 'PerformTransaction': return this.perform(params)
      case 'CancelTransaction': return this.cancel(params)
      case 'CheckTransaction': return this.check(params)
      case 'GetStatement': return this.statement(params)
      default: throw new PaymeFault(PaymeError.MethodNotFound, method)
    }
  }

  private async payable(params: Params): Promise<IPayablePurchase> {
    const amount = requireNumber(params, 'amount')
    const account = params.account
    if (!isObject(account)) throw new PaymeFault(PaymeError.InvalidRequest, 'account')

    const raw = account.order
    const number = typeof raw === 'number' || typeof raw === 'string' ? Number(raw) : Number.NaN
    if (!Number.isSafeInteger(number) || number <= 0) throw new PaymeFault(PaymeError.OrderNotFound, 'order')

    const purchase = await this.port.byNumber(number)
    if (!purchase || purchase.method !== EsimPaymentMethod.Payme) throw new PaymeFault(PaymeError.OrderNotFound, 'order')
    if (purchase.status !== PurchaseStatus.AwaitingPayment || this.now() - purchase.createdAt.getTime() > PAYMENT_WINDOW_MS) {
      throw new PaymeFault(PaymeError.OrderNotPayable, 'order')
    }
    if (amount !== tiyinOf(purchase)) throw new PaymeFault(PaymeError.WrongAmount, 'amount')

    return purchase
  }

  private busy(purchase: IPayablePurchase, txn: string | null): boolean {
    if (!purchase.txn || purchase.txn === txn) return false

    return purchase.state === PaymeState.Created || purchase.state === PaymeState.Performed
  }

  private async checkPerform(params: Params): Promise<Record<string, unknown>> {
    const purchase = await this.payable(params)
    if (this.busy(purchase, null)) throw new PaymeFault(PaymeError.OrderBusy, 'order')

    return { allow: true }
  }

  private async create(params: Params): Promise<Record<string, unknown>> {
    const txn = requireString(params, 'id')
    requireNumber(params, 'time')

    const existing = await this.port.byTxn(txn)
    if (existing) {
      if (existing.state !== PaymeState.Created) throw new PaymeFault(PaymeError.CannotPerform, 'state')
      if (this.timedOut(existing)) {
        await this.expire(existing)
        throw new PaymeFault(PaymeError.CannotPerform, 'timeout')
      }

      return { create_time: existing.createdMs ?? 0, transaction: String(existing.number), state: existing.state }
    }

    const purchase = await this.payable(params)
    if (this.busy(purchase, txn)) throw new PaymeFault(PaymeError.OrderBusy, 'order')

    const createdMs = this.now()
    await this.port.record(purchase.id, {
      txn,
      state: PaymeState.Created,
      createdMs,
      performedMs: null,
      cancelledMs: null,
      cancelReason: null,
    })

    return { create_time: createdMs, transaction: String(purchase.number), state: PaymeState.Created }
  }

  private async perform(params: Params): Promise<Record<string, unknown>> {
    const purchase = await this.transaction(params)

    if (purchase.state === PaymeState.Performed) {
      return { transaction: String(purchase.number), perform_time: purchase.performedMs ?? 0, state: purchase.state }
    }
    if (purchase.state !== PaymeState.Created) throw new PaymeFault(PaymeError.CannotPerform, 'state')
    if (this.timedOut(purchase) || purchase.status === PurchaseStatus.Cancelled) {
      await this.expire(purchase)
      throw new PaymeFault(PaymeError.CannotPerform, 'timeout')
    }

    const performedMs = this.now()
    await this.port.markPaid(purchase.id)
    await this.port.record(purchase.id, { state: PaymeState.Performed, performedMs })

    return { transaction: String(purchase.number), perform_time: performedMs, state: PaymeState.Performed }
  }

  private async cancel(params: Params): Promise<Record<string, unknown>> {
    const purchase = await this.transaction(params)
    const reason = requireNumber(params, 'reason')

    if (purchase.state === PaymeState.Performed) throw new PaymeFault(PaymeError.CannotCancel, 'state')
    if (purchase.state !== PaymeState.Created) {
      return { transaction: String(purchase.number), cancel_time: purchase.cancelledMs ?? 0, state: purchase.state }
    }

    const cancelledMs = this.now()
    await this.port.record(purchase.id, { state: PaymeState.CancelledBeforePerform, cancelledMs, cancelReason: reason })
    await this.port.markCancelled(purchase.id)

    return { transaction: String(purchase.number), cancel_time: cancelledMs, state: PaymeState.CancelledBeforePerform }
  }

  private async check(params: Params): Promise<Record<string, unknown>> {
    const purchase = await this.transaction(params)

    return {
      create_time: purchase.createdMs ?? 0,
      perform_time: purchase.performedMs ?? 0,
      cancel_time: purchase.cancelledMs ?? 0,
      transaction: String(purchase.number),
      state: purchase.state,
      reason: purchase.cancelReason ?? null,
    }
  }

  private async statement(params: Params): Promise<Record<string, unknown>> {
    const from = requireNumber(params, 'from')
    const to = requireNumber(params, 'to')
    const purchases = await this.port.between(from, to, EsimPaymentMethod.Payme)

    const transactions = purchases
      .filter(purchase => purchase.txn && purchase.createdMs !== null && purchase.state !== null)
      .sort((a, b) => (a.createdMs ?? 0) - (b.createdMs ?? 0))
      .map(purchase => ({
        id: purchase.txn,
        time: purchase.createdMs,
        amount: tiyinOf(purchase),
        account: { order: String(purchase.number) },
        create_time: purchase.createdMs,
        perform_time: purchase.performedMs ?? 0,
        cancel_time: purchase.cancelledMs ?? 0,
        transaction: String(purchase.number),
        state: purchase.state,
        reason: purchase.cancelReason ?? null,
      }))

    return { transactions }
  }

  private async transaction(params: Params): Promise<IPayablePurchase> {
    const txn = requireString(params, 'id')
    const purchase = await this.port.byTxn(txn)
    if (!purchase || purchase.state === null) throw new PaymeFault(PaymeError.TransactionNotFound, 'id')

    return purchase
  }

  private timedOut(purchase: IPayablePurchase): boolean {
    return purchase.createdMs !== null && this.now() - purchase.createdMs > PAYME_TIMEOUT_MS
  }

  private async expire(purchase: IPayablePurchase): Promise<void> {
    await this.port.record(purchase.id, {
      state: PaymeState.CancelledBeforePerform,
      cancelledMs: this.now(),
      cancelReason: PAYME_TIMEOUT_REASON,
    })
    await this.port.markCancelled(purchase.id)
  }
}
