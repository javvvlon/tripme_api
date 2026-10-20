import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import { GeminiBilling, GeminiClient } from '~/shared/ai/gemini.client'
import { StorageService } from '~/shared/storage/storage.service'
import { MediaService } from '~/shared/storage/media.service'
import { historyOf } from '~/shared/ai/chat'
import { MarketingSettingsEntity } from '~/modules/marketing/selection.entity'
import { DEFAULT_VOICE } from '~/modules/marketing/ai/copywriter'
import { PostEntity } from '../entities'
import { PostsAdminService } from '../posts.admin.service'
import { ARTICLE_TOKENS, BLOG_LOCALES, blogAnswerOf, blogPrompt, blogSystem, imagesIn, MAX_IMAGES, withImage } from './blog.assistant'
import type { BlogLocale, IArticle, IArticleImage, IKnownArticle, IPlacedImage } from './blog.assistant'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IBlogAssistantAnswer {
  kind: 'article' | 'reply'
  reply: string
  suggestions: string[]
  post: { id: string, slug: string, title: string, revised: boolean, images: number, missing_images: number } | null
}

const MAX_PROMPT = 4000

const KNOWN_ARTICLES = 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const IMAGE_FILE = /\.(png|jpe?g|webp)$/i

const BLOG_FOLDER = 'Блог'

const MAX_GENERATED = 4

const IMAGE_RATIO = '16:9'

interface IPictures {
  byLocale: Partial<Record<BlogLocale, IPlacedImage[]>>
  cover: string | null
  missing: number
}

@Injectable()
export class BlogAssistantService {
  private readonly logger = new Logger(BlogAssistantService.name)

  constructor(
    @InjectRepository(PostEntity) private readonly posts: Repository<PostEntity>,
    @InjectRepository(MarketingSettingsEntity) private readonly settings: Repository<MarketingSettingsEntity>,
    private readonly admin: PostsAdminService,
    private readonly gemini: GeminiClient,
    private readonly storage: StorageService,
    private readonly media: MediaService,
  ) {}

  async assist(input: { text?: unknown, history?: unknown, post_id?: unknown }, actorId: string): Promise<IBlogAssistantAnswer> {
    if (!this.gemini.configured) throw new ServiceUnavailableException('GEMINI_API_KEY is not set')

    const text = typeof input.text === 'string' ? input.text.trim().slice(0, MAX_PROMPT) : ''

    if (!text) throw new BadRequestException('Write what article you need')

    const draft = await this.draftOf(input.post_id)
    const stored = await this.settings.findOne({ where: { id: 1 } })
    const raw = await this.gemini.json<unknown>(
      blogSystem(stored?.voice.trim() || DEFAULT_VOICE),
      blogPrompt({ text, history: historyOf(input.history), articles: await this.known(), draft: draft?.article ?? null }),
      { temperature: 0.7, maxTokens: ARTICLE_TOKENS },
    )
    const answer = blogAnswerOf(raw, `article-${Date.now().toString(36)}`)

    const article = answer.article

    if (!article) return { kind: 'reply', reply: answer.reply, suggestions: answer.suggestions, post: null }

    const revise = answer.intent === 'revise' && draft
    const id = revise ? draft.id : await this.create(article, actorId)
    const kept = revise ? this.keptPictures(draft.article) : null
    const pictures = kept && kept.cover ? kept : await this.pictures(article.images ?? [], article.translations.ru?.title ?? '')
    const current = await this.posts.findOneOrFail({ where: { id } })

    await this.admin.update(id, {
      badge_type: article.badge_type,
      ...(!current.imageUrl && pictures.cover ? { image_url: pictures.cover } : {}),
      translations: BLOG_LOCALES.flatMap((locale) => {
        const value = article.translations[locale]
        const placed = pictures.byLocale[locale] ?? pictures.byLocale.ru ?? []
        const body = placed.reduce((text, image) => withImage(text, image.section, image.url, image.caption), value?.body ?? '')

        return value ? [{ locale, title: value.title, excerpt: value.excerpt, body, badge_label: value.badge_label || null }] : []
      }),
    })

    const post = await this.posts.findOneOrFail({ where: { id } })
    const placedCount = (pictures.byLocale.ru ?? []).filter(image => image.section > 0).length

    return {
      kind: 'article',
      reply: answer.reply,
      suggestions: answer.suggestions,
      post: { id, slug: post.slug, title: article.translations.ru?.title ?? '', revised: Boolean(revise), images: placedCount, missing_images: pictures.missing },
    }
  }

  private keptPictures(article: IArticle): IPictures {
    const byLocale = Object.fromEntries(BLOG_LOCALES.map(locale => [locale, imagesIn(article.translations[locale]?.body ?? '')]))

    return { byLocale, cover: byLocale.ru?.[0]?.url ?? null, missing: 0 }
  }

  private async pictures(images: IArticleImage[], title: string): Promise<IPictures> {
    const used = new Set<string>()
    const byLocale: Partial<Record<BlogLocale, IPlacedImage[]>> = {}
    let cover: string | null = null
    let generated = 0
    let canGenerate = this.gemini.configured && this.storage.configured
    let missing = 0

    for (const image of images.slice(0, MAX_IMAGES * 2)) {
      let url = await this.fromLibrary(image.keywords, used)

      if (!url && canGenerate && generated < MAX_GENERATED && image.prompt) {
        try {
          url = await this.generate(image, title)
          generated++
        }
        catch (error) {
          if (error instanceof GeminiBilling) canGenerate = false

          this.logger.warn(`blog image ${image.keywords[0]}: ${String(error)}`)
        }
      }

      if (!url) {
        missing++
        continue
      }

      used.add(url)
      cover ??= url

      for (const locale of BLOG_LOCALES) {
        (byLocale[locale] ??= []).push({ section: image.section, url, caption: image.caption[locale] || image.caption.ru || image.keywords[0] || '' })
      }
    }

    return { byLocale, cover, missing }
  }

  private async fromLibrary(keywords: string[], used: Set<string>): Promise<string | null> {
    for (const word of keywords) {
      const files = await this.media.library(word).catch(() => [])
      const file = files.find(item => IMAGE_FILE.test(item.path) && !used.has(item.url))

      if (file) return file.url
    }

    return null
  }

  private async generate(image: IArticleImage, title: string): Promise<string> {
    const picture = await this.gemini.image(`${image.prompt}. Realistic travel photography, natural light, no text, no logos, no watermarks.`, IMAGE_RATIO)
    const extension = picture.mimeType === 'image/jpeg' ? 'jpg' : picture.mimeType === 'image/webp' ? 'webp' : 'png'
    const stored = await this.storage.upload({ buffer: picture.data, mimetype: picture.mimeType, originalname: `blog.${extension}`, size: picture.data.length })

    try {
      const folder = await this.media.createFolder(BLOG_FOLDER)

      await this.media.describe(stored.url, { title: (image.caption.ru || image.keywords[0] || title).slice(0, 120), folder: folder.id })
    }
    catch (error) {
      this.logger.warn(`blog image not filed: ${String(error)}`)
    }

    return stored.url
  }

  private async create(article: IArticle, actorId: string): Promise<string> {
    const base = article.slug
    let slug = base

    for (let n = 2; await this.posts.exists({ where: { slug } }); n++) slug = `${base.slice(0, 56)}-${n}`

    const created = await this.admin.create({ slug, title: article.translations.ru?.title ?? slug, locale: 'ru' }, actorId)

    return created.uuid
  }

  private async draftOf(raw: unknown): Promise<{ id: string, article: IArticle } | null> {
    if (typeof raw !== 'string' || !UUID.test(raw)) return null

    const post = await this.posts.findOne({ where: { id: raw }, relations: { translations: true } })

    if (!post || post.isPublished) return null

    return {
      id: post.id,
      article: {
        slug: post.slug,
        badge_type: (post.badgeType as IArticle['badge_type']) ?? null,
        translations: Object.fromEntries(post.translations
          .filter(item => (BLOG_LOCALES as readonly string[]).includes(item.locale))
          .map(item => [item.locale, { title: item.title, excerpt: item.excerpt, badge_label: item.badgeLabel ?? '', body: item.body }])),
      },
    }
  }

  private async known(): Promise<IKnownArticle[]> {
    const rows = await this.posts.find({ relations: { translations: true }, order: { updatedAt: 'DESC' }, take: KNOWN_ARTICLES })

    return rows.map(row => ({
      slug: row.slug,
      title: row.translations.find(item => item.locale === 'ru')?.title || row.translations[0]?.title || row.slug,
      published: row.isPublished,
    }))
  }
}
