import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '~/modules/auth/auth.module'
import { PostsController } from './posts.controller'
import { PostsAdminController } from './posts.admin.controller'
import { PostsService } from './posts.service'
import { PostsAdminService } from './posts.admin.service'
import { PostEntity, PostTranslationEntity } from './entities'
import { MarketingSettingsEntity } from '~/modules/marketing/selection.entity'
import { GeminiClient } from '~/shared/ai/gemini.client'
import { BlogAssistantService } from './assistant/blog.assistant.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([PostEntity, PostTranslationEntity, MarketingSettingsEntity]),
  ],
  controllers: [PostsController, PostsAdminController],
  providers: [PostsService, PostsAdminService, BlogAssistantService, GeminiClient],
  exports: [PostsService],
})
export class PostsModule {}
