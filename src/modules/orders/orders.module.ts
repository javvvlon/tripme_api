import { Module } from '@nestjs/common'
import type { OnModuleInit } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '~/modules/auth/auth.module'
import { LeadsModule } from '~/modules/leads/leads.module'
import { PointsModule } from '~/modules/points/points.module'
import { ReferencesModule } from '~/modules/references/references.module'
import { LeadsService } from '~/modules/leads/leads.service'
import { LeadEntity } from '~/modules/leads/lead.entity'
import { OrdersController } from './orders.controller'
import { OrdersService } from './orders.service'
import { OrderEntity } from './order.entity'
import { OrderEventEntity } from './order-event.entity'
import { OrderDocumentEntity } from './order-document.entity'
import { DocumentsService } from './documents/documents.service'
import { OrderItemEntity } from './items/order-item.entity'
import { OrderItemsService } from './items/order-items.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [AuthModule, LeadsModule, PointsModule, ReferencesModule, TypeOrmModule.forFeature([OrderEntity, OrderEventEntity, OrderDocumentEntity, OrderItemEntity, LeadEntity])],
  controllers: [OrdersController],
  providers: [OrdersService, DocumentsService, OrderItemsService],
  exports: [OrdersService, DocumentsService, OrderItemsService],
})
export class OrdersModule implements OnModuleInit {
  constructor(
    private readonly orders: OrdersService,
    private readonly leads: LeadsService,
  ) {}

  onModuleInit(): void {
    this.leads.registerStatusGuard((leadId, next) => this.orders.assertLeadMayBecome(leadId, next))
    this.leads.registerRemovalHook(leadId => this.orders.releaseLead(leadId))
  }
}
