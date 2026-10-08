import { siteUrl } from '../esim.links'
import type { EsimPaymentMethod } from '../esim.rules'
import type { IPaymentGateway, IPaymentStart } from './gateway'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class SandboxGateway implements IPaymentGateway {
  readonly sandbox = true

  constructor(readonly method: EsimPaymentMethod) {}

  startUrl(input: IPaymentStart): string {
    return `${siteUrl()}/${input.locale}/esim/pay/${input.token}?method=${this.method}`
  }
}
