import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '~/modules/auth/auth.module'
import { LeadsAdminController, LeadsController } from './leads.controller'
import { LeadsService } from './leads.service'
import { LeadEntity } from './lead.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([LeadEntity])],
  controllers: [LeadsController, LeadsAdminController],
  providers: [LeadsService],
})
export class LeadsModule {}
