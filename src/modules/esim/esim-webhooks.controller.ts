import { Body, Controller, Headers, HttpCode, Inject, NotFoundException, Post } from '@nestjs/common'
import { clickConfig, clickConfigured } from './payments/click.gateway'
import { ClickShopApi } from './payments/click.shop'
import { paymeConfig, paymeConfigured } from './payments/payme.gateway'
import { PaymeMerchantApi } from './payments/payme.merchant'
import { PURCHASE_PAYMENTS } from './payments/purchase-payments.port'
import type { IPurchasePayments } from './payments/purchase-payments.port'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('esim')
export class EsimWebhooksController {
  private paymeApi: PaymeMerchantApi | null = null
  private clickApi: ClickShopApi | null = null

  constructor(@Inject(PURCHASE_PAYMENTS) private readonly payments: IPurchasePayments) {}

  @Post('payme')
  @HttpCode(200)
  payme(@Headers('authorization') authorization: string | undefined, @Body() body: unknown) {
    return this.paymeHandler().handle(authorization, body)
  }

  @Post('click/prepare')
  @HttpCode(200)
  clickPrepare(@Body() body: unknown) {
    return this.clickHandler().prepare(body)
  }

  @Post('click/complete')
  @HttpCode(200)
  clickComplete(@Body() body: unknown) {
    return this.clickHandler().complete(body)
  }

  private paymeHandler(): PaymeMerchantApi {
    if (!paymeConfigured()) throw new NotFoundException()
    this.paymeApi ??= new PaymeMerchantApi(this.payments, paymeConfig().key)

    return this.paymeApi
  }

  private clickHandler(): ClickShopApi {
    if (!clickConfigured()) throw new NotFoundException()

    const config = clickConfig()
    this.clickApi ??= new ClickShopApi(this.payments, config.secretKey, config.serviceId)

    return this.clickApi
  }
}
