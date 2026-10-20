import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '~/modules/auth/auth.module'
import { MarketingModule } from '~/modules/marketing/marketing.module'
import { MarketingSettingsEntity } from '~/modules/marketing/selection.entity'
import { PostsModule } from '~/modules/posts/posts.module'
import { GeminiClient } from '~/shared/ai/gemini.client'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [AuthModule, MarketingModule, PostsModule, TypeOrmModule.forFeature([MarketingSettingsEntity])],
  controllers: [AiController],
  providers: [AiService, GeminiClient],
})
export class AiModule {}
