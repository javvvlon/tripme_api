import { EsimPaymentMethod } from '../esim.rules'
import type { IPaymentGateway, IPaymentStart } from './gateway'

export interface IClickConfig {
  serviceId: string
  merchantId: string
  secretKey: string
}

export const clickConfig = (): IClickConfig => ({
  serviceId: (process.env.CLICK_SERVICE_ID ?? '').trim(),
  merchantId: (process.env.CLICK_MERCHANT_ID ?? '').trim(),
  secretKey: (process.env.CLICK_SECRET_KEY ?? '').trim(),
})

export const clickConfigured = (): boolean => {
  const config = clickConfig()

  return Boolean(config.serviceId && config.merchantId && config.secretKey)
}

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class ClickGateway implements IPaymentGateway {
  readonly method = EsimPaymentMethod.Click
  readonly sandbox = false

  constructor(private readonly config: IClickConfig = clickConfig()) {}

  startUrl(input: IPaymentStart): string {
    const query = new URLSearchParams({
      service_id: this.config.serviceId,
      merchant_id: this.config.merchantId,
      amount: input.amountUzs.toFixed(2),
      transaction_param: String(input.purchaseNumber),
      return_url: input.returnUrl,
    })

    return `https://my.click.uz/services/pay?${query.toString()}`
  }
}
