import { EsimPaymentMethod } from '../esim.rules'
import type { IPaymentGateway, IPaymentStart } from './gateway'

const PAYME_LOCALES = ['uz', 'ru', 'en']

export interface IPaymeConfig {
  merchantId: string
  key: string
  baseUrl: string
}

export const paymeConfig = (): IPaymeConfig => ({
  merchantId: (process.env.PAYME_MERCHANT_ID ?? '').trim(),
  key: (process.env.PAYME_KEY ?? '').trim(),
  baseUrl: process.env.PAYME_TEST === '1' ? 'https://test.paycom.uz' : 'https://checkout.paycom.uz',
})

export const paymeConfigured = (): boolean => {
  const config = paymeConfig()

  return Boolean(config.merchantId && config.key)
}

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class PaymeGateway implements IPaymentGateway {
  readonly method = EsimPaymentMethod.Payme
  readonly sandbox = false

  constructor(private readonly config: IPaymeConfig = paymeConfig()) {}

  startUrl(input: IPaymentStart): string {
    const locale = PAYME_LOCALES.includes(input.locale) ? input.locale : 'ru'
    const params = [
      `m=${this.config.merchantId}`,
      `ac.order=${input.purchaseNumber}`,
      `a=${Math.round(input.amountUzs * 100)}`,
      `c=${input.returnUrl}`,
      `l=${locale}`,
    ].join(';')

    return `${this.config.baseUrl}/${Buffer.from(params, 'utf8').toString('base64')}`
  }
}
