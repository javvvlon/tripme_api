import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '~/modules/auth/auth.module'
import { LeadsAdminController, LeadsController } from './leads.controller'
import { LeadsService } from './leads.service'
import { LeadEntity } from './lead.entity'
import { LeadEventEntity } from './lead-event.entity'
import { UserEntity } from '~/modules/auth/entities'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([LeadEntity, LeadEventEntity, UserEntity])],
  controllers: [LeadsController, LeadsAdminController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
