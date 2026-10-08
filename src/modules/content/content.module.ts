import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ContentController } from './content.controller'
import { ContentAdminController } from './content.admin.controller'
import { ContentService } from './content.service'
import { ContentAdminService } from './content.admin.service'
import { AuthModule } from '~/modules/auth/auth.module'
import { PostsModule } from '~/modules/posts/posts.module'
import {
  ContentBannerEntity,
  ContentBannerTranslationEntity,
  ContentItemEntity,
  ContentPageEntity,
  ContentItemTranslationEntity,
  ContentLayoutEntity,
  ContentListEntity,
  ContentSectionEntity,
  ContentSectionTranslationEntity,
} from './entities'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [
    AuthModule,
    PostsModule,
    TypeOrmModule.forFeature([
      ContentSectionEntity,
      ContentSectionTranslationEntity,
      ContentListEntity,
      ContentItemEntity,
      ContentItemTranslationEntity,
      ContentLayoutEntity,
      ContentBannerEntity,
      ContentBannerTranslationEntity,
      ContentPageEntity,
    ]),
  ],
  controllers: [ContentController, ContentAdminController],
  providers: [ContentService, ContentAdminService],
  exports: [ContentService],
})
export class ContentModule {}
