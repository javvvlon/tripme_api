import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, IsNull, Not, Repository, Like } from 'typeorm'
import { PostEntity } from './entities'

export interface IPostTranslationPayload {
  locale: string
  title: string
  excerpt: string
  body: string
  badge_label: string | null
}

export interface IPostAuthorPayload {
  uuid: string
  first_name: string
  last_name: string
}

export interface IPostPayload {
  uuid: string
  slug: string
  image_url: string | null
  badge_type: string | null
  link: string | null
  published_at: string | null
  tour: Record<string, unknown> | null
  author: IPostAuthorPayload | null
  translations: IPostTranslationPayload[]
}

export const LEGAL_SLUG_PREFIX = 'legal-'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(PostEntity)
    private readonly posts: Repository<PostEntity>,
  ) {}
  async published(limit = 12): Promise<IPostPayload[]> {
    const rows = await this.posts.find({
      where: { isPublished: true, publishedAt: Not(IsNull()), slug: Not(Like(`${LEGAL_SLUG_PREFIX}%`)) },
      relations: { translations: true, author: true },
      order: { publishedAt: 'DESC' },
      take: limit,
    })

    return rows.map(row => this.toPayload(row))
  }

  async byIds(ids: string[]): Promise<IPostPayload[]> {
    if (!ids.length) return []

    const rows = await this.posts.find({
      where: { id: In(ids), isPublished: true },
      relations: { translations: true, author: true },
    })

    return rows.map(row => this.toPayload(row))
  }

  async bySlug(slug: string): Promise<IPostPayload> {
    const row = await this.posts.findOne({
      where: { slug, isPublished: true },
      relations: { translations: true, author: true },
    })

    if (!row) throw new NotFoundException('Post not found')

    return this.toPayload(row)
  }

  toPayload(row: PostEntity): IPostPayload {
    return {
      uuid: row.id,
      slug: row.slug,
      image_url: row.imageUrl,
      badge_type: row.badgeType,
      link: row.link,
      published_at: row.publishedAt ? row.publishedAt.toISOString() : null,
      tour: row.tour ?? null,
      author: row.author
        ? { uuid: row.author.id, first_name: row.author.firstName, last_name: row.author.lastName }
        : null,
      translations: (row.translations ?? []).map(translation => ({
        locale: translation.locale,
        title: translation.title,
        excerpt: translation.excerpt,
        body: translation.body,
        badge_label: translation.badgeLabel,
      })),
    }
  }
}
