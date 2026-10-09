import { Module } from '@nestjs/common'
import type { OnModuleInit } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { UserEntity } from '~/modules/auth/entities'
import { LeadEntity } from '~/modules/leads/lead.entity'
import { OrderEntity } from '~/modules/orders/order.entity'
import { OrderItemEntity } from '~/modules/orders/items/order-item.entity'
import { OrdersModule } from '~/modules/orders/orders.module'
import { OrdersService } from '~/modules/orders/orders.service'
import { EsimModule } from '~/modules/esim/esim.module'
import { EsimService } from '~/modules/esim/esim.service'
import { NotificationsService } from './notifications.service'
import { MessagesModule } from '~/modules/messages/messages.module'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [
    OrdersModule,
    EsimModule,
    MessagesModule,
    TypeOrmModule.forFeature([OrderEntity, LeadEntity, UserEntity, OrderItemEntity]),
  ],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule implements OnModuleInit {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly orders: OrdersService,
    private readonly esim: EsimService,
  ) {}

  onModuleInit(): void {
    this.orders.onEvent(event => this.notifications.orderEvent(event))
    this.esim.onIssued(purchase => this.notifications.esimIssued(purchase))
  }
}
