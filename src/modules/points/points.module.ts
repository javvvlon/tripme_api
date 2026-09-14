import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '~/modules/auth/auth.module'
import { UserEntity } from '~/modules/auth/entities'
import { LeadEntity } from '~/modules/leads/lead.entity'
import { OrderEntity } from '~/modules/orders/order.entity'
import { AccountPointsController, PointsController } from './points.controller'
import { PointsService } from './points.service'
import { PointsSettingsEntity, PointsTierEntity, PointsTransactionEntity } from './points.entities'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      PointsTierEntity, PointsSettingsEntity, PointsTransactionEntity,
      OrderEntity, LeadEntity, UserEntity,
    ]),
  ],
  controllers: [PointsController, AccountPointsController],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
