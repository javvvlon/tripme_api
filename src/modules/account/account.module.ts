import { Module } from '@nestjs/common'
import type { OnModuleInit } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '~/modules/auth/auth.module'
import { OrdersModule } from '~/modules/orders/orders.module'
import { MessagesModule } from '~/modules/messages/messages.module'
import { LeadEntity } from '~/modules/leads/lead.entity'
import { OrderEntity } from '~/modules/orders/order.entity'
import { OrderEventEntity } from '~/modules/orders/order-event.entity'
import { UserEntity } from '~/modules/auth/entities'
import { EsimPurchaseEntity } from '~/modules/esim/purchase.entity'
import { VerificationService } from '~/modules/auth/services/verification.service'
import { AuthService } from '~/modules/auth/services/auth.service'
import { TravellerEntity } from './traveller.entity'
import { AccountController, CustomerTravellersController } from './account.controller'
import { AccountService } from './account.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [
    AuthModule,
    OrdersModule,
    MessagesModule,
    TypeOrmModule.forFeature([LeadEntity, OrderEntity, OrderEventEntity, UserEntity, TravellerEntity, EsimPurchaseEntity]),
  ],
  controllers: [AccountController, CustomerTravellersController],
  providers: [AccountService],
})
export class AccountModule implements OnModuleInit {
  constructor(
    private readonly account: AccountService,
    private readonly verification: VerificationService,
    private readonly auth: AuthService,
  ) {}

  onModuleInit(): void {
    this.verification.onPhoneVerified(async (userId, phone) => { await this.account.linkByPhone(userId, phone) })
    this.verification.onEmailVerified((userId, email) => this.account.linkEsimByEmail(userId, email))
    this.auth.onAccountDeleted(userId => this.account.forget(userId))
  }
}
