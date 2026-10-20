import { transcriptOf, withoutEmoji } from '~/shared/ai/chat'
import type { IChatTurn } from '~/shared/ai/chat'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const BLOG_LOCALES = ['ru', 'uz', 'en'] as const

export type BlogLocale = typeof BLOG_LOCALES[number]

export const BADGE_TYPES = ['primary', 'secondary', 'sale'] as const

export type BadgeType = typeof BADGE_TYPES[number]

export type BlogIntent = 'article' | 'revise' | 'reply'

export const ARTICLE_TOKENS = 8192

export interface IArticleText {
  title: string
  excerpt: string
  badge_label: string
  body: string
}

export interface IArticleImage {
  section: number
  keywords: string[]
  caption: Partial<Record<BlogLocale, string>>
  prompt: string
}

export interface IArticle {
  slug: string
  badge_type: BadgeType | null
  translations: Partial<Record<BlogLocale, IArticleText>>
  images?: IArticleImage[]
}

export interface IBlogAnswer {
  intent: BlogIntent
  reply: string
  suggestions: string[]
  article: IArticle | null
}

export interface IKnownArticle {
  slug: string
  title: string
  published: boolean
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const MAX_TITLE = 120

const MAX_EXCERPT = 300

const MAX_BADGE = 24

const MAX_BODY = 12_000

export const MAX_IMAGES = 4

const WANTS_PICTURES = /(фото|картин|иллюстрац|изображен|снимк|image|picture|photo|illustrat|rasm|surat)/i

export const BLOG_RULES = [
  'Structure of a TripMe blog article, written in Markdown:',
  '- A lead of one or two short paragraphs without a heading: why the topic matters for the reader.',
  '- Three to six sections, each opening with a "## " heading in sentence case.',
  '- Inside sections: short paragraphs and "- " bullet lists. Put the name of a place, hotel or thing in **bold** at the start of a bullet.',
  '- Exactly one tip from a manager as a quote line: "> Совет менеджера: …" in Russian, "> Menejer maslahati: …" in Uzbek, "> Manager\'s tip: …" in English.',
  '- End with one calm practical line inviting the reader to plan the trip with TripMe or check details (visas, prices, dates) with a TripMe manager. No hard sell, no urgency, no exclamation marks.',
  '- 1,500–4,000 characters per language. A list article («10 причин …», «7 идей …») has one "## " section per item, each with a short paragraph of two or three sentences, not a single bullet. No H1 (the title is separate), no tables, no HTML and no links.',
  '- Never write image links yourself. Describe pictures in "images" and the system inserts real photos.',
  '- Never state prices, dates, flight schedules or visa rules as facts; say they change and suggest checking with a manager.',
  'Fields:',
  '- title: up to 90 characters, specific; may use a number («7 идей …») or a choice («Шарм-эль-Шейх или Хургада: …»). Russian titles use «ёлочки» quotes.',
  '- excerpt: one or two sentences up to 200 characters for the blog card.',
  '- badge_type: "primary" for guides and checklists, "secondary" for ideas, routes and weekends, "sale" for savings and value, or null.',
  '- badge_label: one short word for the card badge in each language, e.g. Гид, Чек-лист, Идеи, Маршрут, Выходные, Советы, Выгодно.',
  '- slug: lowercase English words joined with hyphens, up to 60 characters.',
  '- Write ru, uz (Latin script) and en versions with the same structure. Uzbek and English are faithful versions, not word-for-word translations.',
  `- images: up to ${MAX_IMAGES} pictures when they help. When the staff member asks for illustrations, pictures or photos, plan one picture per section, up to ${MAX_IMAGES * 2}. section: the 1-based number of the "## " section the picture belongs to, or 0 for the cover only. keywords: two or three short place names in Russian and English to search the photo library (e.g. "Регистан", "Registan", "Самарканд"). caption: a short caption per language. prompt: an English description of a realistic travel photo of that place, without text, logos or close-up faces.`,
].join('\n')

export const blogSystem = (voice: string): string => [
  'You are the editor of the TripMe blog (tripme.uz, a tour agency in Uzbekistan) inside the staff CMS. You talk with managers and marketers.',
  'The blog serves three audiences in three languages: people in Uzbekistan travelling abroad, foreign travellers planning a trip to Uzbekistan, and anyone choosing a trip with TripMe. Any travel topic is in scope: destinations abroad, Uzbekistan itself, trip planning, documents, money, seasons and tips. Never refuse a travel topic and never question the brief: write it.',
  'Decide what the staff member wants:',
  '- "article": write a new article when they name a topic or ask for an article.',
  '- "revise": change the current draft (only when a current draft is given): shorten, add or remove a section, change the tone, fix something, rewrite a language. Return the whole revised article.',
  '- "reply": anything else — topic ideas, advice on an article plan, questions about the blog, feedback on an article they paste. Do not write an article then.',
  'Always fill "reply" (it is never empty) and talk back in the language of the last staff message. For article or revise, say in two to four sentences what you wrote and give two or three concrete recommendations: a cover photo idea, a tour or selection worth attaching, what to check before publishing. For reply, answer the question; when suggesting topics, avoid the existing articles listed below and explain each idea in one line.',
  'Use the formal «Вы». No emoji anywhere.',
  BLOG_RULES,
  `TripMe voice:\n${voice}`,
  'suggestions: up to 3 short next messages the staff member might send, in the same language.',
  'Return JSON only.',
].join('\n\n')

export function blogPrompt(input: { text: string, history: IChatTurn[], articles: IKnownArticle[], draft: IArticle | null }): string {
  const text: IArticleText = { title: '', excerpt: '', badge_label: '', body: '' }
  const image: IArticleImage = { section: 1, keywords: [], caption: { ru: '', uz: '', en: '' }, prompt: '' }
  const shape = { intent: 'article', reply: '', suggestions: [], article: { slug: '', badge_type: null, translations: { ru: text, uz: text, en: text }, images: [image] } }

  return [
    `Return exactly this JSON shape (article is null for "reply"): ${JSON.stringify(shape)}`,
    input.articles.length ? `Existing articles:\n${input.articles.map(item => `- ${item.title} (${item.slug}${item.published ? '' : ', draft'})`).join('\n')}` : '',
    input.draft ? `Current draft:\n${JSON.stringify(input.draft)}` : '',
    input.history.length ? `Conversation so far:\n${transcriptOf(input.history)}` : '',
    WANTS_PICTURES.test(input.text) ? `The staff member wants pictures: plan one picture for every "## " section in "images", up to ${MAX_IMAGES * 2}, plus one cover picture with section 0.` : '',
    'Start every body with the lead paragraph before the first "## " heading.',
    `Staff: ${input.text}`,
  ].filter(Boolean).join('\n\n')
}

const plain = (value: unknown, max: number): string =>
  typeof value === 'string' ? withoutEmoji(value).replace(/\s+/g, ' ').trim().slice(0, max) : ''

export function markdownOf(value: unknown): string {
  if (typeof value !== 'string') return ''

  return withoutEmoji(value)
    .replace(/\r\n?/g, '\n')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/^#\s+/gm, '## ')
    .replace(/^#{3,}\s+/gm, '### ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_BODY)
}

export function slugOf(value: unknown, fallback: string): string {
  const slug = (typeof value === 'string' ? value : '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')

  return SLUG_PATTERN.test(slug) ? slug : fallback
}

function textOf(raw: unknown): IArticleText | null {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const title = plain(input.title, MAX_TITLE)
  const body = markdownOf(input.body)

  if (!title || !body) return null

  return { title, excerpt: plain(input.excerpt, MAX_EXCERPT), badge_label: plain(input.badge_label, MAX_BADGE), body }
}

export function blogAnswerOf(raw: unknown, fallbackSlug: string): IBlogAnswer {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const intent: BlogIntent = input.intent === 'article' || input.intent === 'revise' ? input.intent : 'reply'
  const suggestions = (Array.isArray(input.suggestions) ? input.suggestions : []).map(item => plain(item, 90)).filter(Boolean).slice(0, 3)
  const reply = typeof input.reply === 'string' ? withoutEmoji(input.reply).trim().slice(0, 3000) : ''
  const rawArticle = input.article && typeof input.article === 'object' ? input.article as Record<string, unknown> : null
  const rawTexts = rawArticle?.translations && typeof rawArticle.translations === 'object' ? rawArticle.translations as Record<string, unknown> : {}
  const translations: Partial<Record<BlogLocale, IArticleText>> = {}

  for (const locale of BLOG_LOCALES) {
    const text = textOf(rawTexts[locale])

    if (text) translations[locale] = text
  }

  const article = intent !== 'reply' && translations.ru
    ? {
        slug: slugOf(rawArticle?.slug, fallbackSlug),
        badge_type: BADGE_TYPES.includes(rawArticle?.badge_type as BadgeType) ? rawArticle?.badge_type as BadgeType : null,
        translations,
        images: imagesOf(rawArticle?.images),
      }
    : null

  return { intent: article ? intent : 'reply', reply, suggestions, article }
}

export function imagesOf(raw: unknown, limit = MAX_IMAGES * 2): IArticleImage[] {
  const list = Array.isArray(raw) ? raw : []

  return list.flatMap((item) => {
    const input = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    const keywords = (Array.isArray(input.keywords) ? input.keywords : []).map(word => plain(word, 40)).filter(word => word.length > 1).slice(0, 3)
    const captions = input.caption && typeof input.caption === 'object' ? input.caption as Record<string, unknown> : {}
    const section = Math.round(Number(input.section))

    if (!keywords.length || !Number.isFinite(section) || section < 0 || section > 20) return []

    return [{
      section,
      keywords,
      caption: Object.fromEntries(BLOG_LOCALES.map(locale => [locale, plain(captions[locale], 140).replace(/[[\]()"]/g, '')])),
      prompt: plain(input.prompt, 400),
    }]
  }).slice(0, limit)
}

export function withImage(body: string, section: number, url: string, caption: string): string {
  if (section < 1) return body

  const lines = body.split('\n')
  const headings = lines.flatMap((line, index) => (line.startsWith('## ') ? [index] : []))
  const heading = headings[section - 1]

  if (heading === undefined) return body

  let at = heading + 1

  const line = (index: number): string => lines[index] ?? ''

  while (at < lines.length && !line(at).trim()) at++
  while (at < lines.length && line(at).trim() && !line(at).startsWith('## ')) at++

  lines.splice(at, 0, '', `![${caption}](${url} "full")`)

  return lines.join('\n').replace(/\n{3,}/g, '\n\n')
}

export interface IPlacedImage {
  section: number
  url: string
  caption: string
}

export function imagesIn(body: string): IPlacedImage[] {
  let section = 0

  return body.split('\n').flatMap((line) => {
    if (line.startsWith('## ')) section++

    const match = /^!\[([^\]]*)\]\((\S+)(?:\s+"[^"]*")?\)\s*$/.exec(line.trim())

    return match ? [{ section, url: match[2] ?? '', caption: match[1] ?? '' }] : []
  })
}
