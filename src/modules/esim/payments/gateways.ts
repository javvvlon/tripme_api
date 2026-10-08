import { EsimPaymentMethod } from '../esim.rules'
import { esimSandbox } from '../esim.links'
import { SandboxGateway } from './sandbox.gateway'
import { PaymeGateway, paymeConfigured } from './payme.gateway'
import { ClickGateway, clickConfigured } from './click.gateway'
import type { IPaymentGateway } from './gateway'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export function gatewaysFromEnv(): IPaymentGateway[] {
  const sandbox = esimSandbox()
  const gateways: Array<IPaymentGateway | null> = [
    paymeConfigured() ? new PaymeGateway() : sandbox ? new SandboxGateway(EsimPaymentMethod.Payme) : null,
    clickConfigured() ? new ClickGateway() : sandbox ? new SandboxGateway(EsimPaymentMethod.Click) : null,
    sandbox ? new SandboxGateway(EsimPaymentMethod.Card) : null,
  ]

  return gateways.filter((gateway): gateway is IPaymentGateway => gateway !== null)
}
