import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ContentBannerEntity, ContentSectionEntity } from './entities'
import { PostsService } from '~/modules/posts/posts.service'
import type { IPostPayload } from '~/modules/posts/posts.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IHomeContentResponse {
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
    translations: Array<{ locale: string, title: string }>
    link: string | null
    variant: string
    list_id: string | null
    layout_id: string
    position: number
  }>
  layouts: Array<{ uuid: string, grid: string, name: string | null }>
  lists: Array<{
    uuid: string
    name: string
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

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(ContentSectionEntity)
    private readonly sections: Repository<ContentSectionEntity>,
    @InjectRepository(ContentBannerEntity)
    private readonly banners: Repository<ContentBannerEntity>,
    private readonly postsService: PostsService,
  ) {}

  async forPage(page = 'home'): Promise<IHomeContentResponse> {
    /**
     * The banner travels with the sections rather than on its own endpoint:
     * the home page cannot render without both, and two requests would be two
     * chances to render half of it.
     */
    const [banner, sections, posts] = await Promise.all([
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
      this.postsService.published(POSTS_IN_SECTION),
    ])

    const layouts = new Map<string, IHomeContentResponse['layouts'][number]>()
    const lists = new Map<string, IHomeContentResponse['lists'][number]>()

    for (const section of sections) {
      if (section.layout && !layouts.has(section.layout.id)) {
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
      posts,
      sections: sections.map(section => ({
        uuid: section.id,
        variant: section.variant,
        translations: (section.translations ?? []).map(t => ({ locale: t.locale, title: t.title })),
        link: section.link,
        list_id: section.listId,
        layout_id: section.layoutId,
        position: section.position,
      })),
      layouts: [...layouts.values()],
      lists: [...lists.values()],
    }
  }
}
