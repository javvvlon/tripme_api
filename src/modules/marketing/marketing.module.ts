import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '~/modules/auth/auth.module'
import { SearchModule } from '~/modules/search/search.module'
import { LeadEntity } from '~/modules/leads/lead.entity'
import { UserEntity } from '~/modules/auth/entities'
import { MarketingSelectionEntity, MarketingSettingsEntity, MarketingTemplateEntity } from './selection.entity'
import { MarketingService } from './marketing.service'
import { MarketingCmsController, MarketingController, MarketingSettingsController, MarketingTemplatesController } from './marketing.controller'
import { GeminiClient } from './ai/gemini.client'
import { TelegramPublisher } from './telegram.publisher'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [TypeOrmModule.forFeature([MarketingSelectionEntity, MarketingSettingsEntity, MarketingTemplateEntity, LeadEntity, UserEntity]), AuthModule, SearchModule],
  controllers: [MarketingController, MarketingSettingsController, MarketingTemplatesController, MarketingCmsController],
  providers: [MarketingService, GeminiClient, TelegramPublisher],
})
export class MarketingModule {}
