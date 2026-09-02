import { Module } from '@nestjs/common'
import type { OnModuleInit } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '~/modules/auth/auth.module'
import { LeadsModule } from '~/modules/leads/leads.module'
import { LeadsService } from '~/modules/leads/leads.service'
import { LeadEntity } from '~/modules/leads/lead.entity'
import { OrdersController } from './orders.controller'
import { OrdersService } from './orders.service'
import { OrderEntity } from './order.entity'
import { OrderEventEntity } from './order-event.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [AuthModule, LeadsModule, TypeOrmModule.forFeature([OrderEntity, OrderEventEntity, LeadEntity])],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule implements OnModuleInit {
  constructor(
    private readonly orders: OrdersService,
    private readonly leads: LeadsService,
  ) {}

  onModuleInit(): void {
    this.leads.registerStatusGuard((leadId, next) => this.orders.assertLeadMayBecome(leadId, next))
  }
}
