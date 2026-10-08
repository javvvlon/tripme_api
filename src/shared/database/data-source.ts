import 'reflect-metadata'
import { config as loadEnv } from 'dotenv'
import { DataSource } from 'typeorm'
import type { DataSourceOptions } from 'typeorm'
import { UserEntity, SessionEntity, VerificationCodeEntity } from '~/modules/auth/entities'
import {
  ContentBannerEntity,
  ContentPageEntity,
  ContentBannerTranslationEntity,
  ContentItemEntity,
  ContentItemTranslationEntity,
  ContentLayoutEntity,
  ContentListEntity,
  ContentSectionEntity,
  ContentSectionTranslationEntity,
} from '~/modules/content/entities'
import { PostEntity, PostTranslationEntity } from '~/modules/posts/entities'
import { ContactMessageEntity } from '~/modules/contact/contact-message.entity'
import { LeadEntity } from '~/modules/leads/lead.entity'
import { LeadEventEntity } from '~/modules/leads/lead-event.entity'
import { OrderEntity } from '~/modules/orders/order.entity'
import { OrderEventEntity } from '~/modules/orders/order-event.entity'
import { OrderDocumentEntity } from '~/modules/orders/order-document.entity'
import { PointsSettingsEntity, PointsTierEntity, PointsTransactionEntity } from '~/modules/points/points.entities'
import { OperatorEntity } from '~/modules/operators/operator.entity'
import { MediaFileEntity } from '~/shared/storage/media-file.entity'
import { MediaFolderEntity } from '~/shared/storage/media-folder.entity'
import { Auth1755900000000 } from './migrations/1755900000000-Auth'
import { Content1755900001000 } from './migrations/1755900001000-Content'
import { ItemBadges1755900002000 } from './migrations/1755900002000-ItemBadges'
import { Banner1755900003000 } from './migrations/1755900003000-Banner'
import { BannerSubtitle1755900004000 } from './migrations/1755900004000-BannerSubtitle'
import { Posts1755900005000 } from './migrations/1755900005000-Posts'
import { PostAuthor1755900006000 } from './migrations/1755900006000-PostAuthor'
import { SectionPosts1755900007000 } from './migrations/1755900007000-SectionPosts'
import { Leads1755900008000 } from './migrations/1755900008000-Leads'
import { LeadOrders1755900009000 } from './migrations/1755900009000-LeadOrders'
import { LeadPassport1755900010000 } from './migrations/1755900010000-LeadPassport'
import { PostTour1755900011000 } from './migrations/1755900011000-PostTour'
import { Orders1755900012000 } from './migrations/1755900012000-Orders'
import { ClientFields1755900013000 } from './migrations/1755900013000-ClientFields'
import { Operators1755900014000 } from './migrations/1755900014000-Operators'
import { MediaTitles1755900015000 } from './migrations/1755900015000-MediaTitles'
import { MediaFolders1755900016000 } from './migrations/1755900016000-MediaFolders'
import { OrderDocuments1755900017000 } from './migrations/1755900017000-OrderDocuments'
import { LeadUser1755900018000 } from './migrations/1755900018000-LeadUser'
import { Points1755900019000 } from './migrations/1755900019000-Points'
import { ComplianceFields1755900020000 } from './migrations/1755900020000-ComplianceFields'
import { UserConsent1755900021000 } from './migrations/1755900021000-UserConsent'
import { ContentBlocks1755900022000 } from './migrations/1755900022000-ContentBlocks'
import { DropSectionVariant1755900023000 } from './migrations/1755900023000-DropSectionVariant'
import { PageBuilder1755900025000 } from './migrations/1755900025000-PageBuilder'
import { RichBlocks1755900026000 } from './migrations/1755900026000-RichBlocks'
import { HomeBlocks1755900027000 } from './migrations/1755900027000-HomeBlocks'
import { PrestigeOperator1755900028000 } from './migrations/1755900028000-PrestigeOperator'
import { LeadOwnership1755900029000 } from './migrations/1755900029000-LeadOwnership'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const databaseOptions = (): DataSourceOptions => {
  loadEnv()

  const url = process.env.DATABASE_URL

  if (!url) {
    throw new Error('DATABASE_URL is not set — see .env.example')
  }

  return {
    type: 'postgres',
    url,
    entities: [
      UserEntity, SessionEntity, VerificationCodeEntity,
      ContentLayoutEntity, ContentListEntity, ContentItemEntity,
      ContentItemTranslationEntity, ContentSectionEntity, ContentSectionTranslationEntity,
      ContentBannerEntity, ContentBannerTranslationEntity, ContentPageEntity,
      PostEntity, PostTranslationEntity, ContactMessageEntity, LeadEntity, LeadEventEntity, OrderEntity, OrderEventEntity, OrderDocumentEntity, OperatorEntity,
      PointsTierEntity, PointsSettingsEntity, PointsTransactionEntity,
      MediaFileEntity, MediaFolderEntity,
    ],
    migrations: [
      Auth1755900000000, Content1755900001000, ItemBadges1755900002000, Banner1755900003000,
      BannerSubtitle1755900004000,
      Posts1755900005000,
      PostAuthor1755900006000,
      SectionPosts1755900007000,
      Leads1755900008000,
      LeadOrders1755900009000,
      LeadPassport1755900010000,
      PostTour1755900011000,
      Orders1755900012000,
      ClientFields1755900013000,
      Operators1755900014000,
      MediaTitles1755900015000,
      MediaFolders1755900016000,
      OrderDocuments1755900017000,
      LeadUser1755900018000,
      Points1755900019000,
      ComplianceFields1755900020000,
      UserConsent1755900021000,
      ContentBlocks1755900022000,
      DropSectionVariant1755900023000,
      PageBuilder1755900025000,
      RichBlocks1755900026000,
      HomeBlocks1755900027000,
      PrestigeOperator1755900028000,
      LeadOwnership1755900029000,
    ],
    synchronize: false,
    migrationsRun: false,
    logging: process.env.DATABASE_LOGGING === '1',
    ssl: process.env.DATABASE_SSL === '0' ? undefined : { rejectUnauthorized: false },
    extra: {
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    },
  }
}

export default new DataSource(databaseOptions())
