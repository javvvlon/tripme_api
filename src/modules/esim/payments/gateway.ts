import type { EsimPaymentMethod } from '../esim.rules'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IPaymentStart {
  purchaseNumber: number
  token: string
  amountUzs: number
  returnUrl: string
  locale: string
}

export interface IPaymentGateway {
  readonly method: EsimPaymentMethod
  readonly sandbox: boolean
  startUrl(input: IPaymentStart): string
}

export const PAYMENT_GATEWAYS = Symbol('PAYMENT_GATEWAYS')
