import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '~/modules/auth/auth.module'
import { ReferencesModule } from '~/modules/references/references.module'
import { EsimPurchaseEntity } from './purchase.entity'
import { EsimService } from './esim.service'
import { EsimController } from './esim.controller'
import { EsimCmsController } from './esim-cms.controller'
import { EsimWebhooksController } from './esim-webhooks.controller'
import { ESIM_PROVIDER } from './provider/esim-provider'
import { SandboxEsimProvider } from './provider/sandbox.provider'
import { PAYMENT_GATEWAYS } from './payments/gateway'
import { PURCHASE_PAYMENTS } from './payments/purchase-payments.port'
import { gatewaysFromEnv } from './payments/gateways'
import { esimSandbox } from './esim.links'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [TypeOrmModule.forFeature([EsimPurchaseEntity]), AuthModule, ReferencesModule],
  controllers: [EsimController, EsimCmsController, EsimWebhooksController],
  providers: [
    EsimService,
    { provide: ESIM_PROVIDER, useFactory: () => (esimSandbox() ? new SandboxEsimProvider() : null) },
    { provide: PAYMENT_GATEWAYS, useFactory: gatewaysFromEnv },
    { provide: PURCHASE_PAYMENTS, useExisting: EsimService },
  ],
})
export class EsimModule {}
