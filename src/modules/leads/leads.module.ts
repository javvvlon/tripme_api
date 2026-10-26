import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '~/modules/auth/auth.module'
import { LeadsAdminController, LeadsController } from './leads.controller'
import { LeadsService } from './leads.service'
import { LeadEntity } from './lead.entity'
import { LeadEventEntity } from './lead-event.entity'
import { UserEntity } from '~/modules/auth/entities'
import { SearchModule } from '~/modules/search/search.module'
import { ReferencesModule } from '~/modules/references/references.module'
import { GeminiClient } from '~/shared/ai/gemini.client'
import { LeadSearchService } from './ai/lead-search.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [AuthModule, SearchModule, ReferencesModule, TypeOrmModule.forFeature([LeadEntity, LeadEventEntity, UserEntity])],
  controllers: [LeadsController, LeadsAdminController],
  providers: [LeadsService, LeadSearchService, GeminiClient],
  exports: [LeadsService],
})
export class LeadsModule {}
