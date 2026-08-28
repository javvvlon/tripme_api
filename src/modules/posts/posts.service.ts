import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, Not, Repository } from 'typeorm'
import { PostEntity } from './entities'

export interface IPostTranslationPayload {
  locale: string
  title: string
  excerpt: string
  body: string
  badge_label: string | null
}

export interface IPostPayload {
  uuid: string
  slug: string
  image_url: string | null
  badge_type: string | null
  link: string | null
  published_at: string | null
  translations: IPostTranslationPayload[]
}

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
      where: { isPublished: true, publishedAt: Not(IsNull()) },
      relations: { translations: true },
      order: { publishedAt: 'DESC' },
      take: limit,
    })

    return rows.map(row => this.toPayload(row))
  }

  async bySlug(slug: string): Promise<IPostPayload> {
    const row = await this.posts.findOne({
      where: { slug, isPublished: true },
      relations: { translations: true },
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
