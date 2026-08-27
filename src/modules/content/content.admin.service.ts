import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import {
  ContentBannerEntity,
  ContentItemEntity,
  ContentLayoutEntity,
  ContentListEntity,
  ContentSectionEntity,
} from './entities'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface ITranslationInput {
  locale: string
  title: string
  description?: string | null
  badge_label?: string | null
}

export const BADGE_TYPES = ['primary', 'secondary', 'sale'] as const

export type BadgeType = typeof BADGE_TYPES[number]

export interface IListItemInput {
  image_url?: string | null
  link?: string | null
  badge_type?: string | null
  translations: ITranslationInput[]
}

export interface IListInput {
  name: string
  items: IListItemInput[]
}

export interface IBannerInput {
  translations: Array<{
    locale: string
    title: string
    subtitle?: string | null
    image_url?: string | null
  }>
}

export interface ISectionInput {
  link?: string | null
  list_id: string
  layout_id: string
  is_published?: boolean
  translations: Array<{ locale: string, title: string }>
}

@Injectable()
export class ContentAdminService {
  constructor(
    @InjectRepository(ContentListEntity) private readonly lists: Repository<ContentListEntity>,
    @InjectRepository(ContentLayoutEntity) private readonly layouts: Repository<ContentLayoutEntity>,
    @InjectRepository(ContentSectionEntity) private readonly sections: Repository<ContentSectionEntity>,
    @InjectRepository(ContentBannerEntity) private readonly banners: Repository<ContentBannerEntity>,
    private readonly dataSource: DataSource,
  ) {}

  layoutsAll() {
    return this.layouts.find({ order: { grid: 'ASC' } })
  }

  async listsIndex() {
    const rows = await this.lists
      .createQueryBuilder('list')
      .leftJoin('list.items', 'item')
      .select(['list.id', 'list.name', 'list.updatedAt'])
      .addSelect('count(item.id)', 'items_count')
      .groupBy('list.id')
      .orderBy('list.updated_at', 'DESC')
      .getRawMany<{
        list_id: string
        list_name: string
        list_updated_at: Date
        items_count: string
      }>()

    return rows.map(row => ({
      uuid: row.list_id,
      name: row.list_name,
      items_count: Number(row.items_count),
      updated_at: row.list_updated_at,
    }))
  }

  async list(id: string) {
    const list = await this.lists.findOne({
      where: { id },
      relations: { items: { translations: true } },
    })

    if (!list) throw new NotFoundException('No such list')

    return {
      uuid: list.id,
      name: list.name,
      items: [...(list.items ?? [])]
        .sort((a, b) => a.position - b.position)
        .map(item => ({
          uuid: item.id,
          image_url: item.imageUrl,
          link: item.link,
          position: item.position,
          badge_type: item.badgeType,
          translations: (item.translations ?? []).map(t => ({
            locale: t.locale,
            title: t.title,
            description: t.description,
            badge_label: t.badgeLabel,
          })),
        })),
    }
  }

  async createList(input: IListInput): Promise<{ uuid: string }> {
    const saved = await this.lists.save({ name: input.name.trim() })

    await this.replaceItems(saved.id, input.items)

    return { uuid: saved.id }
  }

  async updateList(id: string, input: IListInput): Promise<{ uuid: string }> {
    const exists = await this.lists.existsBy({ id })
    if (!exists) throw new NotFoundException('No such list')

    await this.lists.update({ id }, { name: input.name.trim() })
    await this.replaceItems(id, input.items)

    return { uuid: id }
  }

  async deleteList(id: string): Promise<void> {
    const used = await this.sections.countBy({ listId: id })

    if (used) {
      throw new NotFoundException(`That list is used by ${used} section(s) — remove them first`)
    }

    await this.lists.delete({ id })
  }

  private async replaceItems(listId: string, items: IListItemInput[]): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(ContentItemEntity).delete({ listId })

      for (const [index, item] of items.entries()) {
        await manager.getRepository(ContentItemEntity).save({
          listId,
          imageUrl: blank(item.image_url),
          link: blank(item.link),
          position: index + 1,
          badgeType: badgeType(item.badge_type),
          translations: item.translations
            .filter(t => t.title?.trim())
            .map(t => ({
              locale: t.locale,
              title: t.title.trim(),
              description: blank(t.description),
              badgeLabel: blank(t.badge_label),
            })),
        })
      }

      await manager.getRepository(ContentListEntity).update({ id: listId }, { updatedAt: new Date() })
    })
  }

  async banner(page = 'home') {
    const banner = await this.banners.findOne({ where: { page }, relations: { translations: true } })

    return {
      id: banner?.id ?? null,
      translations: (banner?.translations ?? []).map(t => ({
        locale: t.locale,
        title: t.title,
        subtitle: t.subtitle,
        image_url: t.imageUrl,
      })),
    }
  }

  async saveBanner(page: string, input: IBannerInput) {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ContentBannerEntity)
      const existing = await repo.findOne({ where: { page } })

      if (existing) await repo.delete({ id: existing.id })

      await repo.save({
        page,
        translations: input.translations.map(t => ({
          locale: t.locale,
          title: t.title?.trim() ?? '',
          subtitle: blank(t.subtitle),
          imageUrl: blank(t.image_url),
        })),
      })
    })

    return this.banner(page)
  }

  async sectionsFor(page = 'home') {
    const sections = await this.sections.find({
      where: { page },
      relations: { translations: true },
      order: { position: 'ASC' },
    })

    return sections.map(section => ({
      uuid: section.id,
      link: section.link,
      list_id: section.listId,
      layout_id: section.layoutId,
      position: section.position,
      is_published: section.isPublished,
      translations: (section.translations ?? []).map(t => ({ locale: t.locale, title: t.title })),
    }))
  }

  async replaceSections(page: string, input: ISectionInput[]): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(ContentSectionEntity).delete({ page })

      for (const [index, section] of input.entries()) {
        await manager.getRepository(ContentSectionEntity).save({
          page,
          link: blank(section.link),
          listId: section.list_id,
          layoutId: section.layout_id,
          position: index + 1,
          isPublished: section.is_published ?? true,
          translations: section.translations
            .filter(t => t.title?.trim())
            .map(t => ({ locale: t.locale, title: t.title.trim() })),
        })
      }
    })
  }
}

const blank = (value: string | null | undefined): string | null => value?.trim() || null

const badgeType = (value: string | null | undefined): string | null =>
  BADGE_TYPES.includes(value as BadgeType) ? value! : null
