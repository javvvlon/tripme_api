import 'reflect-metadata'
import { config as loadEnv } from 'dotenv'
import { DataSource } from 'typeorm'
import type { DataSourceOptions } from 'typeorm'
import { UserEntity, SessionEntity, VerificationCodeEntity } from '~/modules/auth/entities'
import {
  ContentBannerEntity,
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
import { Auth1755900000000 } from './migrations/1755900000000-Auth'
import { Content1755900001000 } from './migrations/1755900001000-Content'
import { ItemBadges1755900002000 } from './migrations/1755900002000-ItemBadges'
import { Banner1755900003000 } from './migrations/1755900003000-Banner'
import { BannerSubtitle1755900004000 } from './migrations/1755900004000-BannerSubtitle'
import { Posts1755900005000 } from './migrations/1755900005000-Posts'

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
      ContentBannerEntity, ContentBannerTranslationEntity,
      PostEntity, PostTranslationEntity, ContactMessageEntity,
    ],
    migrations: [
      Auth1755900000000, Content1755900001000, ItemBadges1755900002000, Banner1755900003000,
      BannerSubtitle1755900004000,
      Posts1755900005000,
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
