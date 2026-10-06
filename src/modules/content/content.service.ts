import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ContentBannerEntity, ContentPageEntity, ContentSectionEntity } from './entities'
import { sectionPayload } from './content.admin.service'
import { BLOCK_RULES, isSectionKind } from './content.blocks'
import type { ContentPage, ISectionSettings, SectionKind, SectionSource } from './content.blocks'
import { PostsService } from '~/modules/posts/posts.service'
import type { IPostPayload } from '~/modules/posts/posts.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IPageContentResponse {
  page: ContentPage
  seo: Record<string, { title?: string, description?: string }>
  banner: {
    translations: Array<{
      locale: string
      title: string
      subtitle: string | null
      image_url: string | null
    }>
  } | null
  sections: Array<{
    uuid: string
    kind: SectionKind
    source: SectionSource
    translations: Array<{
      locale: string
      title: string
      subtitle: string | null
      eyebrow: string | null
      body: string | null
      cta_label: string | null
    }>
    settings: ISectionSettings
    link: string | null
    anchor: string | null
    post_ids: string[]
    list_id: string | null
    layout_id: string | null
    position: number
  }>
  layouts: Array<{ uuid: string, grid: string, name: string | null }>
  lists: Array<{
    uuid: string
    name: string
    kind: string
    items: Array<{
      uuid: string
      image_url: string | null
      link: string | null
      position: number
      badge_type: string | null
      translations: Array<{
        locale: string
        title: string
        description: string | null
        badge_label: string | null
      }>
    }>
  }>
  posts: IPostPayload[]
}

const POSTS_IN_SECTION = 12

const POSTS_ON_BLOG = 500

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(ContentSectionEntity)
    private readonly sections: Repository<ContentSectionEntity>,
    @InjectRepository(ContentBannerEntity)
    private readonly banners: Repository<ContentBannerEntity>,
    @InjectRepository(ContentPageEntity)
    private readonly pages: Repository<ContentPageEntity>,
    private readonly postsService: PostsService,
  ) {}

  async forPage(page: ContentPage = 'home'): Promise<IPageContentResponse> {
    const [banner, sections, posts, meta] = await Promise.all([
      this.banners.findOne({ where: { page }, relations: { translations: true } }),
      this.sections.find({
        where: { page, isPublished: true },
        relations: {
          translations: true,
          layout: true,
          list: { items: { translations: true } },
        },
        order: { position: 'ASC' },
      }),
      this.postsService.published(page === 'blog' ? POSTS_ON_BLOG : POSTS_IN_SECTION),
      this.pages.findOne({ where: { page } }),
    ])

    const pinned = sections.flatMap(section => section.postIds ?? [])
    const missing = pinned.filter(id => !posts.some(post => post.uuid === id))
    const extra = await this.postsService.byIds([...new Set(missing)])

    const layouts = new Map<string, IPageContentResponse['layouts'][number]>()
    const lists = new Map<string, IPageContentResponse['lists'][number]>()

    for (const section of sections) {
      const kind = isSectionKind(section.kind) ? section.kind : 'cards'

      if (BLOCK_RULES[kind].layout && section.layout && !layouts.has(section.layout.id)) {
        layouts.set(section.layout.id, {
          uuid: section.layout.id,
          grid: section.layout.grid,
          name: section.layout.name,
        })
      }

      if (section.list && !lists.has(section.list.id)) {
        lists.set(section.list.id, {
          uuid: section.list.id,
          name: section.list.name,
          kind: section.list.kind,
          items: [...(section.list.items ?? [])]
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
        })
      }
    }

    return {
      page,
      seo: meta?.seo ?? {},
      banner: banner
        ? {
            translations: (banner.translations ?? []).map(t => ({
              locale: t.locale,
              title: t.title,
              subtitle: t.subtitle,
              image_url: t.imageUrl,
            })),
          }
        : null,
      posts: [...posts, ...extra],
      sections: sections.map(section => sectionPayload(section)),
      layouts: [...layouts.values()],
      lists: [...lists.values()],
    }
  }
}
