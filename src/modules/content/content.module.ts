import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ContentController } from './content.controller'
import { ContentAdminController } from './content.admin.controller'
import { ContentService } from './content.service'
import { ContentAdminService } from './content.admin.service'
import { RevalidationService } from './revalidation.service'
import { AuthModule } from '~/modules/auth/auth.module'
import {
  ContentBannerEntity,
  ContentBannerTranslationEntity,
  ContentItemEntity,
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
    TypeOrmModule.forFeature([
      ContentSectionEntity,
      ContentSectionTranslationEntity,
      ContentListEntity,
      ContentItemEntity,
      ContentItemTranslationEntity,
      ContentLayoutEntity,
      ContentBannerEntity,
      ContentBannerTranslationEntity,
    ]),
  ],
  controllers: [ContentController, ContentAdminController],
  providers: [ContentService, ContentAdminService, RevalidationService],
  exports: [ContentService],
})
export class ContentModule {}
