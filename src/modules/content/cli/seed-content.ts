import 'reflect-metadata'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DataSource } from 'typeorm'
import { AppModule } from '~/app.module'
import {
  ContentItemEntity,
  ContentLayoutEntity,
  ContentListEntity,
  ContentSectionEntity,
} from '~/modules/content/entities'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
interface ISeed {
  layouts: Array<{ uuid: string, grid: string, name: string | null }>
  lists: Array<{
    uuid: string
    name: string
    items: Array<{
      uuid: string
      image_url: string | null
      link: string | null
      position: number
      translations: Array<{ locale: string, title: string, description: string | null }>
    }>
  }>
  sections: Array<{
    uuid: string
    link: string | null
    list_id: string
    layout_id: string
    position: number
    translations: Array<{ locale: string, title: string }>
  }>
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force')
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false })
  const logger = new Logger('seed:content')

  try {
    const dataSource = app.get(DataSource)
    const sections = dataSource.getRepository(ContentSectionEntity)

    if (await sections.count() && !force) {
      logger.warn('content_sections is not empty — pass --force to replace it')
      process.exit(1)
    }

    const seed = JSON.parse(
      readFileSync(join(__dirname, '../fixtures/home-content.json'), 'utf8'),
    ) as ISeed

    await dataSource.transaction(async (manager) => {
      for (const entity of [ContentSectionEntity, ContentListEntity, ContentLayoutEntity]) {
        await manager.createQueryBuilder().delete().from(entity).execute()
      }

      const layouts = new Map<string, string>()

      for (const layout of seed.layouts) {
        const saved = await manager.getRepository(ContentLayoutEntity)
          .save({ grid: layout.grid, name: layout.name })

        layouts.set(layout.uuid, saved.id)
      }

      const lists = new Map<string, string>()

      for (const list of seed.lists) {
        const saved = await manager.getRepository(ContentListEntity).save({ name: list.name })
        lists.set(list.uuid, saved.id)

        for (const item of list.items) {
          await manager.getRepository(ContentItemEntity).save({
            listId: saved.id,
            imageUrl: item.image_url,
            link: item.link,
            position: item.position,
            translations: item.translations.map(t => ({
              locale: t.locale,
              title: t.title,
              description: t.description,
            })),
          })
        }
      }

      for (const section of seed.sections) {
        await manager.getRepository(ContentSectionEntity).save({
          page: 'home',
          link: section.link,
          listId: lists.get(section.list_id)!,
          layoutId: layouts.get(section.layout_id)!,
          position: section.position,
          isPublished: true,
          translations: section.translations.map(t => ({ locale: t.locale, title: t.title })),
        })
      }
    })

    const counts = {
      layouts: await dataSource.getRepository(ContentLayoutEntity).count(),
      lists: await dataSource.getRepository(ContentListEntity).count(),
      items: await dataSource.getRepository(ContentItemEntity).count(),
      sections: await sections.count(),
    }

    logger.log(`seeded ${JSON.stringify(counts)}`)
  }
  finally {
    await app.close()
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
