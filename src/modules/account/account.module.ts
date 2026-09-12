import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '~/modules/auth/auth.module'
import { OrdersModule } from '~/modules/orders/orders.module'
import { LeadEntity } from '~/modules/leads/lead.entity'
import { OrderEntity } from '~/modules/orders/order.entity'
import { OrderEventEntity } from '~/modules/orders/order-event.entity'
import { UserEntity } from '~/modules/auth/entities'
import { AccountController } from './account.controller'
import { AccountService } from './account.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [
    AuthModule,
    OrdersModule,
    TypeOrmModule.forFeature([LeadEntity, OrderEntity, OrderEventEntity, UserEntity]),
  ],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
