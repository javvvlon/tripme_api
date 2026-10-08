/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IPayablePurchase {
  id: string
  number: number
  status: string
  method: string
  amountUzs: number
  createdAt: Date
  txn: string | null
  state: number | null
  createdMs: number | null
  performedMs: number | null
  cancelledMs: number | null
  cancelReason: number | null
}

export interface IPaymentStatePatch {
  txn?: string | null
  state?: number | null
  createdMs?: number | null
  performedMs?: number | null
  cancelledMs?: number | null
  cancelReason?: number | null
}

export interface IPurchasePayments {
  byNumber(number: number): Promise<IPayablePurchase | null>
  byTxn(txn: string): Promise<IPayablePurchase | null>
  between(fromMs: number, toMs: number, method: string): Promise<IPayablePurchase[]>
  record(id: string, patch: IPaymentStatePatch): Promise<void>
  markPaid(id: string): Promise<void>
  markCancelled(id: string): Promise<void>
}

export const PURCHASE_PAYMENTS = Symbol('PURCHASE_PAYMENTS')
