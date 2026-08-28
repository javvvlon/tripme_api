import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Not, Repository } from 'typeorm'
import { PostEntity, PostTranslationEntity } from './entities'
import type { IPostPayload } from './posts.service'
import { PostsService } from './posts.service'

export interface IPostCreateInput {
  slug?: string
  title?: string
  locale?: string
}

export interface IPostInput {
  slug?: string
  image_url?: string | null
  badge_type?: string | null
  link?: string | null
  is_published?: boolean
  translations?: Array<{
    locale: string
    title?: string
    excerpt?: string
    body?: string
    badge_label?: string | null
  }>
}

export interface IPostAdminPayload extends IPostPayload {
  is_published: boolean
  updated_at: string
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class PostsAdminService {
  constructor(
    @InjectRepository(PostEntity)
    private readonly posts: Repository<PostEntity>,
    @InjectRepository(PostTranslationEntity)
    private readonly translations: Repository<PostTranslationEntity>,
    private readonly service: PostsService,
  ) {}

  async list(): Promise<IPostAdminPayload[]> {
    const rows = await this.posts.find({
      relations: { translations: true },
      order: { updatedAt: 'DESC' },
    })

    return rows.map(row => this.toAdminPayload(row))
  }

  async one(id: string): Promise<IPostAdminPayload> {
    const row = await this.posts.findOne({ where: { id }, relations: { translations: true } })

    if (!row) throw new NotFoundException('Post not found')

    return this.toAdminPayload(row)
  }
  async create(input: IPostCreateInput): Promise<IPostAdminPayload> {
    const slug = this.normaliseSlug(input.slug ?? '')
    const title = (input.title ?? '').trim()
    const locale = (input.locale ?? 'ru').trim() || 'ru'

    if (!title) throw new BadRequestException('A title is required')

    await this.assertSlugIsFree(slug)

    const post = this.posts.create({
      slug,
      isPublished: false,
      translations: [this.translations.create({ locale, title, excerpt: '', body: '' })],
    })

    const saved = await this.posts.save(post)

    return this.one(saved.id)
  }

  async update(id: string, input: IPostInput): Promise<IPostAdminPayload> {
    const post = await this.posts.findOne({ where: { id }, relations: { translations: true } })

    if (!post) throw new NotFoundException('Post not found')

    if (input.slug !== undefined) {
      const slug = this.normaliseSlug(input.slug)

      await this.assertSlugIsFree(slug, id)

      post.slug = slug
    }

    if (input.image_url !== undefined) post.imageUrl = input.image_url
    if (input.badge_type !== undefined) post.badgeType = input.badge_type
    if (input.link !== undefined) post.link = input.link
    if (input.is_published !== undefined) {
      post.isPublished = input.is_published

      if (input.is_published && !post.publishedAt) post.publishedAt = new Date()
    }

    post.updatedAt = new Date()

    if (input.translations) {
      for (const incoming of input.translations) {
        const existing = post.translations.find(translation => translation.locale === incoming.locale)

        if (existing) {
          if (incoming.title !== undefined) existing.title = incoming.title
          if (incoming.excerpt !== undefined) existing.excerpt = incoming.excerpt
          if (incoming.body !== undefined) existing.body = incoming.body
          if (incoming.badge_label !== undefined) existing.badgeLabel = incoming.badge_label
          continue
        }

        post.translations.push(this.translations.create({
          locale: incoming.locale,
          title: incoming.title ?? '',
          excerpt: incoming.excerpt ?? '',
          body: incoming.body ?? '',
          badgeLabel: incoming.badge_label ?? null,
        }))
      }
    }

    await this.posts.save(post)

    return this.one(id)
  }

  async remove(id: string): Promise<{ removed: boolean }> {
    const result = await this.posts.delete({ id })

    if (!result.affected) throw new NotFoundException('Post not found')

    return { removed: true }
  }

  private normaliseSlug(raw: string): string {
    const slug = raw.trim().toLowerCase()

    if (!SLUG_PATTERN.test(slug)) {
      throw new BadRequestException('A slug may hold lowercase letters, digits and single hyphens')
    }

    return slug
  }

  private async assertSlugIsFree(slug: string, exceptId?: string): Promise<void> {
    const taken = await this.posts.findOne({
      where: exceptId ? { slug, id: Not(exceptId) } : { slug },
      select: { id: true },
    })

    if (taken) throw new ConflictException('That slug is already taken')
  }

  private toAdminPayload(row: PostEntity): IPostAdminPayload {
    return {
      ...this.service.toPayload(row),
      is_published: row.isPublished,
      updated_at: row.updatedAt.toISOString(),
    }
  }
}
