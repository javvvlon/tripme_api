import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '~/modules/auth/auth.module'
import { FinanceModule } from '~/modules/finance/finance.module'
import { ReferencesModule } from '~/modules/references/references.module'
import { LeadEntity } from '~/modules/leads/lead.entity'
import { OrderEntity } from '~/modules/orders/order.entity'
import { OrderEventEntity } from '~/modules/orders/order-event.entity'
import { UserEntity } from '~/modules/auth/entities'
import { AnalyticsController } from './analytics.controller'
import { AnalyticsService } from './analytics.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [AuthModule, ReferencesModule, FinanceModule, TypeOrmModule.forFeature([LeadEntity, OrderEntity, OrderEventEntity, UserEntity])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
