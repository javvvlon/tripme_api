import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, In, Repository } from 'typeorm'
import {
  ContentBannerEntity,
  ContentItemEntity,
  ContentPageEntity,
  ContentLayoutEntity,
  ContentListEntity,
  ContentSectionEntity,
} from './entities'
import { BLOCK_RULES, isBadgeType, isSectionKind, normaliseAnchor, sectionProblem, sectionSettings } from './content.blocks'
import type { ContentPage, ListKind, SectionKind, SectionSource } from './content.blocks'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface ITranslationInput {
  locale: string
  title: string
  description?: string | null
  badge_label?: string | null
}

export interface IListItemInput {
  image_url?: string | null
  link?: string | null
  badge_type?: string | null
  translations: ITranslationInput[]
}

const COLUMNS = 12

const normaliseGrid = (value: unknown): string => {
  const grid = typeof value === 'string' ? value.trim() : ''
  const parts = grid.split('_')

  if (!grid || !parts.length) throw new BadRequestException('A layout needs a grid, such as 4_4_4')

  let filled = 0

  for (const part of parts) {
    const spans = part.split('.').map(Number)

    if (spans.some(span => !Number.isInteger(span) || span < 1 || span > COLUMNS)) {
      throw new BadRequestException(`"${part}" is not a column of 1 to ${COLUMNS}`)
    }

    if (spans.some(span => span !== spans[0])) {
      throw new BadRequestException(`"${part}" stacks cells of different widths`)
    }

    filled = filled + spans[0]! > COLUMNS ? spans[0]! : filled + spans[0]!
  }

  return grid
}

export interface ILayoutInput {
  grid: string
  name: string
}

export interface IListInput {
  name: string
  kind: ListKind
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
  kind: SectionKind
  source: SectionSource
  link?: string | null
  anchor?: string | null
  post_ids?: string[]
  list_id?: string | null
  layout_id?: string | null
  is_published?: boolean
  settings?: unknown
  translations: Array<{
    locale: string
    title: string
    subtitle?: string | null
    eyebrow?: string | null
    body?: string | null
    cta_label?: string | null
  }>
}

export interface IPageMetaInput {
  seo: Record<string, { title?: string, description?: string }>
}

@Injectable()
export class ContentAdminService {
  constructor(
    @InjectRepository(ContentListEntity) private readonly lists: Repository<ContentListEntity>,
    @InjectRepository(ContentLayoutEntity) private readonly layouts: Repository<ContentLayoutEntity>,
    @InjectRepository(ContentSectionEntity) private readonly sections: Repository<ContentSectionEntity>,
    @InjectRepository(ContentBannerEntity) private readonly banners: Repository<ContentBannerEntity>,
    @InjectRepository(ContentPageEntity) private readonly pages: Repository<ContentPageEntity>,
    private readonly dataSource: DataSource,
  ) {}

  layoutsAll() {
    return this.layouts.find({ order: { grid: 'ASC' } })
  }

  async createLayout(input: ILayoutInput): Promise<ContentLayoutEntity> {
    const grid = normaliseGrid(input.grid)
    const taken = await this.layouts.findOne({ where: { grid } })

    if (taken) throw new ConflictException('That layout already exists')

    return this.layouts.save(this.layouts.create({ grid, name: input.name.trim().slice(0, 80) }))
  }

  async removeLayout(id: string): Promise<void> {
    const used = await this.sections.countBy({ layoutId: id })

    if (used) throw new ConflictException('That layout is used by a section')

    const result = await this.layouts.delete({ id })

    if (!result.affected) throw new NotFoundException('No such layout')
  }

  async listsIndex() {
    const rows = await this.lists
      .createQueryBuilder('list')
      .leftJoin('list.items', 'item')
      .select(['list.id', 'list.name', 'list.kind', 'list.updatedAt'])
      .addSelect('count(item.id)', 'items_count')
      .groupBy('list.id')
      .orderBy('list.updated_at', 'DESC')
      .getRawMany<{
        list_id: string
        list_name: string
        list_kind: string
        list_updated_at: Date
        items_count: string
      }>()

    return rows.map(row => ({
      uuid: row.list_id,
      name: row.list_name,
      kind: row.list_kind,
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
      kind: list.kind,
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
    const saved = await this.lists.save({ name: input.name.trim(), kind: input.kind })

    await this.replaceItems(saved.id, input.kind, input.items)

    return { uuid: saved.id }
  }

  async updateList(id: string, input: IListInput): Promise<{ uuid: string }> {
    const current = await this.lists.findOneBy({ id })
    if (!current) throw new NotFoundException('No such list')

    if (current.kind !== input.kind) {
      const used = await this.sections.countBy({ listId: id })

      if (used) throw new ConflictException('A list used on the page cannot change its type')
    }

    await this.lists.update({ id }, { name: input.name.trim(), kind: input.kind })
    await this.replaceItems(id, input.kind, input.items)

    return { uuid: id }
  }

  async deleteList(id: string): Promise<void> {
    const used = await this.sections.countBy({ listId: id })

    if (used) {
      throw new ConflictException(`That list is used by ${used} section(s) — remove them first`)
    }

    await this.lists.delete({ id })
  }

  private async replaceItems(listId: string, kind: ListKind, items: IListItemInput[]): Promise<void> {
    const fields = BLOCK_RULES[kind].item

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(ContentItemEntity).delete({ listId })

      for (const [index, item] of items.entries()) {
        await manager.getRepository(ContentItemEntity).save({
          listId,
          imageUrl: fields.image ? blank(item.image_url) : null,
          link: fields.link ? blank(item.link) : null,
          position: index + 1,
          badgeType: fields.badge && isBadgeType(item.badge_type) ? item.badge_type : null,
          translations: item.translations
            .filter(t => t.title?.trim())
            .map(t => ({
              locale: t.locale,
              title: t.title.trim(),
              description: blank(t.description),
              badgeLabel: fields.badge ? blank(t.badge_label) : null,
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
      ...sectionPayload(section),
      is_published: section.isPublished,
    }))
  }

  async meta(page: ContentPage) {
    const row = await this.pages.findOne({ where: { page } })

    return { page, seo: row?.seo ?? {} }
  }

  async saveMeta(page: ContentPage, input: IPageMetaInput) {
    const seo = Object.fromEntries(Object.entries(input.seo ?? {}).map(([locale, value]) => [locale, {
      title: (value?.title ?? '').trim().slice(0, 120),
      description: (value?.description ?? '').trim().slice(0, 300),
    }]))

    await this.pages.save({ page, seo })

    return this.meta(page)
  }

  async replaceSections(page: ContentPage, input: ISectionInput[]): Promise<void> {
    await this.checkSections(input, page)

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(ContentSectionEntity).delete({ page })

      for (const [index, section] of input.entries()) {
        const rule = BLOCK_RULES[section.kind]
        const fromPosts = section.source === 'posts'

        await manager.getRepository(ContentSectionEntity).save({
          page,
          kind: section.kind,
          source: section.source,
          link: rule.link ? blank(section.link) : null,
          anchor: normaliseAnchor(section.anchor),
          settings: sectionSettings(section.kind, section.settings) as Record<string, unknown>,
          postIds: postIdsFor(section.kind, fromPosts ? (section.post_ids ?? []) : []),
          listId: section.source === 'list' ? (section.list_id ?? null) : null,
          layoutId: rule.layout ? (section.layout_id ?? null) : null,
          position: index + 1,
          isPublished: section.is_published ?? true,
          translations: section.translations
            .filter(t => [t.title, t.subtitle, t.eyebrow, t.body, t.cta_label].some(value => value?.trim()))
            .map(t => ({
              locale: t.locale,
              title: t.title?.trim() ?? '',
              subtitle: blank(t.subtitle),
              eyebrow: blank(t.eyebrow),
              body: blank(t.body),
              ctaLabel: blank(t.cta_label),
            })),
        })
      }
    })
  }

  private async checkSections(input: ISectionInput[], page: ContentPage): Promise<void> {
    const listIds = [...new Set(input.map(section => section.list_id).filter((id): id is string => Boolean(id)))]
    const lists = listIds.length ? await this.lists.findBy({ id: In(listIds) }) : []
    const problem = sectionProblem(input, new Map(lists.map(list => [list.id, list.kind])), page)

    if (problem) throw new BadRequestException(problem)
  }
}

export const sectionPayload = (section: ContentSectionEntity) => {
  const kind: SectionKind = isSectionKind(section.kind) ? section.kind : 'cards'
  const source: SectionSource = BLOCK_RULES[kind].sources.includes(section.source as SectionSource)
    ? section.source as SectionSource
    : BLOCK_RULES[kind].sources[0]!

  return {
    uuid: section.id,
    kind,
    source,
    link: BLOCK_RULES[kind].link ? section.link : null,
    anchor: section.anchor,
    post_ids: section.postIds ?? [],
    list_id: section.listId,
    layout_id: BLOCK_RULES[kind].layout ? section.layoutId : null,
    position: section.position,
    settings: sectionSettings(kind, section.settings),
    translations: (section.translations ?? []).map(t => ({
      locale: t.locale,
      title: t.title,
      subtitle: t.subtitle,
      eyebrow: t.eyebrow,
      body: t.body,
      cta_label: t.ctaLabel,
    })),
  }
}

const blank = (value: string | null | undefined): string | null => value?.trim() || null

const postIdsFor = (kind: SectionKind, ids: string[]): string[] => {
  if (kind === 'feed') return []
  if (kind === 'featured') return ids.slice(0, 1)

  return ids
}
