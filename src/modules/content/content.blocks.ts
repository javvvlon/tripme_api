/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const PAGES = ['home', 'blog'] as const

export type ContentPage = typeof PAGES[number]

export const LIST_KINDS = ['cards', 'features', 'faq'] as const

export type ListKind = typeof LIST_KINDS[number]

export const SECTION_KINDS = ['hero', 'featured', 'cards', 'features', 'faq', 'feed', 'banner', 'media', 'cta', 'quote', 'text', 'spotlight'] as const

export type SectionKind = typeof SECTION_KINDS[number]

export const SECTION_SOURCES = ['list', 'posts', 'none'] as const

export type SectionSource = typeof SECTION_SOURCES[number]

export const BADGE_TYPES = ['primary', 'secondary', 'sale'] as const

export type BadgeType = typeof BADGE_TYPES[number]

export const FEED_PAGE_SIZES = [6, 9, 12, 18, 24] as const

export const SPOTLIGHT_SIZES = [3, 4, 5, 6] as const

export const BANNER_STYLES = ['card', 'wide'] as const

export const BLOCK_TONES = ['light', 'brand', 'dark'] as const

export const IMAGE_SIDES = ['left', 'right'] as const

export interface IItemFields {
  image: boolean
  link: boolean
  badge: boolean
}

export interface IBlockRule {
  pages: readonly ContentPage[]
  sources: readonly SectionSource[]
  layout: boolean
  link: boolean
  titleRequired: boolean
  bodyRequired: boolean
  item: IItemFields
}

const NO_ITEMS: IItemFields = { image: false, link: false, badge: false }

const BOTH: readonly ContentPage[] = ['home', 'blog']

const STANDALONE = { sources: ['none'] as const, layout: false, item: NO_ITEMS }

export const BLOCK_RULES: Record<SectionKind, IBlockRule> = {
  hero: {
    bodyRequired: false,
    pages: ['blog'],
    sources: ['none'],
    layout: false,
    link: false,
    titleRequired: true,
    item: NO_ITEMS,
  },
  featured: {
    bodyRequired: false,
    pages: ['blog'],
    sources: ['posts'],
    layout: false,
    link: false,
    titleRequired: false,
    item: NO_ITEMS,
  },
  cards: {
    bodyRequired: false,
    pages: ['home', 'blog'],
    sources: ['list', 'posts'],
    layout: true,
    link: true,
    titleRequired: true,
    item: { image: true, link: true, badge: true },
  },
  features: {
    bodyRequired: false,
    pages: ['home', 'blog'],
    sources: ['list'],
    layout: false,
    link: false,
    titleRequired: true,
    item: { image: true, link: false, badge: false },
  },
  faq: {
    bodyRequired: false,
    pages: ['home', 'blog'],
    sources: ['list'],
    layout: false,
    link: false,
    titleRequired: true,
    item: NO_ITEMS,
  },
  feed: {
    bodyRequired: false,
    pages: ['blog'],
    sources: ['posts'],
    layout: false,
    link: false,
    titleRequired: false,
    item: NO_ITEMS,
  },
  banner: { ...STANDALONE, pages: BOTH, link: true, titleRequired: true, bodyRequired: false },
  media: { ...STANDALONE, pages: BOTH, link: true, titleRequired: true, bodyRequired: false },
  cta: { ...STANDALONE, pages: BOTH, link: true, titleRequired: true, bodyRequired: false },
  quote: { ...STANDALONE, pages: BOTH, link: false, titleRequired: false, bodyRequired: true },
  text: { ...STANDALONE, pages: BOTH, link: false, titleRequired: false, bodyRequired: true },
  spotlight: {
    pages: BOTH,
    sources: ['posts'],
    layout: false,
    link: true,
    titleRequired: false,
    bodyRequired: false,
    item: NO_ITEMS,
  },
}

export interface ISectionSettings {
  image_url?: string | null
  page_size?: number
  exclude_featured?: boolean
  style?: typeof BANNER_STYLES[number]
  tone?: typeof BLOCK_TONES[number]
  image_side?: typeof IMAGE_SIDES[number]
  list_size?: number
}

const oneOf = <T extends string>(options: readonly T[], value: unknown): T =>
  options.includes(value as T) ? value as T : options[0]!

const imageOf = (input: Record<string, unknown>): string | null =>
  (typeof input.image_url === 'string' ? input.image_url.trim() : '') || null

export function sectionSettings(kind: SectionKind, raw: unknown): ISectionSettings {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  if (kind === 'hero' || kind === 'quote') return { image_url: imageOf(input) }

  if (kind === 'banner') {
    return { image_url: imageOf(input), style: oneOf(BANNER_STYLES, input.style), tone: oneOf(BLOCK_TONES, input.tone) }
  }

  if (kind === 'media') return { image_url: imageOf(input), image_side: oneOf(IMAGE_SIDES, input.image_side) }

  if (kind === 'cta') return { tone: oneOf(BLOCK_TONES, input.tone === undefined ? 'brand' : input.tone) }

  if (kind === 'spotlight') {
    const size = Number(input.list_size)

    return { list_size: SPOTLIGHT_SIZES.includes(size as never) ? size : 4 }
  }

  if (kind === 'feed') {
    const size = Number(input.page_size)

    return {
      page_size: FEED_PAGE_SIZES.includes(size as never) ? size : 9,
      exclude_featured: input.exclude_featured !== false,
    }
  }

  return {}
}

export const isPage = (value: unknown): value is ContentPage => PAGES.includes(value as ContentPage)

export const isListKind = (value: unknown): value is ListKind => LIST_KINDS.includes(value as ListKind)

export const isSectionKind = (value: unknown): value is SectionKind =>
  SECTION_KINDS.includes(value as SectionKind)

export const isSectionSource = (value: unknown): value is SectionSource =>
  SECTION_SOURCES.includes(value as SectionSource)

export const isBadgeType = (value: unknown): value is BadgeType =>
  BADGE_TYPES.includes(value as BadgeType)

export const normaliseAnchor = (value: string | null | undefined): string | null =>
  value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || null

export interface ISectionShape {
  kind: SectionKind
  source: SectionSource
  list_id?: string | null
  layout_id?: string | null
  anchor?: string | null
  translations?: Array<{ title: string, body?: string | null }>
}

export function sectionProblem(
  sections: ISectionShape[],
  listKinds: Map<string, string>,
  page: ContentPage = 'home',
): string | null {
  const anchors = new Set<string>()

  for (const [index, section] of sections.entries()) {
    const rule = BLOCK_RULES[section.kind]
    const at = `Section ${index + 1}`

    if (!rule.pages.includes(page)) return `${at}: "${section.kind}" does not belong on the ${page} page`

    if (!rule.sources.includes(section.source)) return `${at}: "${section.kind}" cannot show "${section.source}"`

    if (rule.titleRequired && section.translations && !section.translations.some(t => t.title?.trim())) {
      return `${at}: needs a heading in at least one language`
    }

    if (rule.bodyRequired && section.translations && !section.translations.some(t => t.body?.trim())) {
      return `${at}: needs text in at least one language`
    }

    if (rule.layout && !section.layout_id) return `${at}: pick a layout`

    if (section.source === 'list') {
      const kind = listKinds.get(section.list_id ?? '')

      if (!kind) return `${at}: pick a list`

      if (kind !== section.kind) return `${at}: a "${kind}" list cannot fill a "${section.kind}" section`
    }

    const anchor = normaliseAnchor(section.anchor)

    if (anchor && anchors.has(anchor)) return `${at}: anchor "${anchor}" is already used`

    if (anchor) anchors.add(anchor)
  }

  return null
}
