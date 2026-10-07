import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Brackets, In, Not, Repository } from 'typeorm'
import { pageOf } from '~/shared/helpers/pagination'
import type { IPage, IPageRequest } from '~/shared/helpers/pagination'
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
  tour?: Record<string, unknown> | null
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

const TITLE_SORT = `lower(coalesce((select t.title from post_translations t where t.post_id = p.id and t.title <> ''
  order by case t.locale when 'ru' then 0 when 'uz' then 1 else 2 end limit 1), ''))`

export const POST_SORTS = {
  title: { expression: TITLE_SORT, flip: false },
  author: { expression: `lower(coalesce(a.first_name, '') || ' ' || coalesce(a.last_name, ''))`, flip: false },
  status: { expression: 'p.is_published', flip: true },
  published: { expression: 'p.published_at', flip: false },
  updated: { expression: 'p.updated_at', flip: false },
} as const

export type PostSort = keyof typeof POST_SORTS

export interface IPostQuery {
  q?: string
  filter?: string
  sort?: string
  dir?: string
}

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
      relations: { translations: true, author: true },
      order: { updatedAt: 'DESC' },
    })

    return rows.map(row => this.toAdminPayload(row))
  }

  async page(query: IPostQuery, request: IPageRequest): Promise<IPage<IPostAdminPayload, { all: number, published: number }>> {
    const filtered = () => {
      const builder = this.posts.createQueryBuilder('p').leftJoin('p.author', 'a')

      if (query.filter === 'published') builder.andWhere('p.is_published = true')
      if (query.filter === 'draft') builder.andWhere('p.is_published = false')

      const needle = (query.q ?? '').trim().toLowerCase()

      if (needle) {
        builder.andWhere(new Brackets((where) => {
          where
            .where('p.slug like :like')
            .orWhere(`exists (select 1 from post_translations t where t.post_id = p.id and lower(t.title) like :like)`)
            .orWhere(`lower(coalesce(a.first_name, '') || ' ' || coalesce(a.last_name, '')) like :like`)
        }), { like: `%${needle}%` })
      }

      return builder
    }

    const sort = POST_SORTS[query.sort as PostSort] ?? POST_SORTS.updated
    const ascending = query.dir === 'asc'
    const direction = (sort.flip ? !ascending : ascending) ? 'ASC' : 'DESC'

    const [ids, total, all, published] = await Promise.all([
      filtered()
        .select('p.id', 'id')
        .addSelect(sort.expression, 'sort_key')
        .orderBy('sort_key', direction, 'NULLS LAST')
        .addOrderBy('p.updated_at', 'DESC')
        .offset(request.skip)
        .limit(request.perPage)
        .getRawMany<{ id: string }>(),
      filtered().getCount(),
      this.posts.count(),
      this.posts.count({ where: { isPublished: true } }),
    ])

    const rows = ids.length
      ? await this.posts.find({ where: { id: In(ids.map(row => row.id)) }, relations: { translations: true, author: true } })
      : []
    const byId = new Map(rows.map(row => [row.id, row]))
    const ordered = ids.map(row => byId.get(row.id)).filter((row): row is PostEntity => Boolean(row))

    return pageOf(ordered.map(row => this.toAdminPayload(row)), total, request, { all, published })
  }

  async one(id: string): Promise<IPostAdminPayload> {
    const row = await this.posts.findOne({ where: { id }, relations: { translations: true, author: true } })

    if (!row) throw new NotFoundException('Post not found')

    return this.toAdminPayload(row)
  }
  async create(input: IPostCreateInput, authorId: string | null): Promise<IPostAdminPayload> {
    const slug = this.normaliseSlug(input.slug ?? '')
    const title = (input.title ?? '').trim()
    const locale = (input.locale ?? 'ru').trim() || 'ru'

    if (!title) throw new BadRequestException('A title is required')

    await this.assertSlugIsFree(slug)

    const post = this.posts.create({
      slug,
      authorId,
      isPublished: false,
      translations: [this.translations.create({ locale, title, excerpt: '', body: '' })],
    })

    const saved = await this.posts.save(post)

    return this.one(saved.id)
  }

  async update(id: string, input: IPostInput): Promise<IPostAdminPayload> {
    const post = await this.posts.findOne({ where: { id }, relations: { translations: true, author: true } })

    if (!post) throw new NotFoundException('Post not found')

    if (input.slug !== undefined) {
      const slug = this.normaliseSlug(input.slug)

      await this.assertSlugIsFree(slug, id)

      post.slug = slug
    }

    if (input.image_url !== undefined) post.imageUrl = input.image_url
    if (input.badge_type !== undefined) post.badgeType = input.badge_type
    if (input.link !== undefined) post.link = input.link

    if (input.tour !== undefined) {
      post.tour = input.tour && Object.keys(input.tour).length ? input.tour : null
    }
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
