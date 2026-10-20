import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '~/modules/auth/auth.module'
import { SearchModule } from '~/modules/search/search.module'
import { ReferencesModule } from '~/modules/references/references.module'
import { LeadEntity } from '~/modules/leads/lead.entity'
import { UserEntity } from '~/modules/auth/entities'
import { MarketingBotLinkEntity, MarketingSelectionEntity, MarketingSettingsEntity, MarketingTemplateEntity } from './selection.entity'
import { MarketingService } from './marketing.service'
import { MarketingBotController, MarketingCmsController, MarketingController, MarketingSettingsController, MarketingTelegramController, MarketingTemplatesController } from './marketing.controller'
import { GeminiClient } from '~/shared/ai/gemini.client'
import { TelegramPublisher } from './telegram.publisher'
import { IntakeService } from './intake/intake.service'
import { BotIntakeService } from './intake/bot.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [TypeOrmModule.forFeature([MarketingSelectionEntity, MarketingSettingsEntity, MarketingTemplateEntity, MarketingBotLinkEntity, LeadEntity, UserEntity]), AuthModule, SearchModule, ReferencesModule],
  controllers: [MarketingController, MarketingTelegramController, MarketingBotController, MarketingSettingsController, MarketingTemplatesController, MarketingCmsController],
  providers: [MarketingService, GeminiClient, TelegramPublisher, IntakeService, BotIntakeService],
  exports: [MarketingService],
})
export class MarketingModule {}
