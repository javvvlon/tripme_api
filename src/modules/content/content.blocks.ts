/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const SECTION_KINDS = ['cards', 'features', 'faq'] as const

export type SectionKind = typeof SECTION_KINDS[number]

export const SECTION_SOURCES = ['list', 'posts'] as const

export type SectionSource = typeof SECTION_SOURCES[number]

export const BADGE_TYPES = ['primary', 'secondary', 'sale'] as const

export type BadgeType = typeof BADGE_TYPES[number]

export interface IItemFields {
  image: boolean
  link: boolean
  badge: boolean
}

export interface IBlockRule {
  sources: readonly SectionSource[]
  layout: boolean
  link: boolean
  item: IItemFields
}

export const BLOCK_RULES: Record<SectionKind, IBlockRule> = {
  cards: {
    sources: ['list', 'posts'],
    layout: true,
    link: true,
    item: { image: true, link: true, badge: true },
  },
  features: {
    sources: ['list'],
    layout: false,
    link: false,
    item: { image: true, link: false, badge: false },
  },
  faq: {
    sources: ['list'],
    layout: false,
    link: false,
    item: { image: false, link: false, badge: false },
  },
}

export const isSectionKind = (value: unknown): value is SectionKind =>
  SECTION_KINDS.includes(value as SectionKind)

export const isSectionSource = (value: unknown): value is SectionSource =>
  SECTION_SOURCES.includes(value as SectionSource)

export const isBadgeType = (value: unknown): value is BadgeType =>
  BADGE_TYPES.includes(value as BadgeType)

export const legacyVariant = (kind: SectionKind, source: SectionSource): string =>
  kind === 'cards' ? source : kind

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
}

export function sectionProblem(sections: ISectionShape[], listKinds: Map<string, string>): string | null {
  const anchors = new Set<string>()

  for (const [index, section] of sections.entries()) {
    const rule = BLOCK_RULES[section.kind]
    const at = `Section ${index + 1}`

    if (!rule.sources.includes(section.source)) return `${at}: "${section.kind}" cannot show "${section.source}"`

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
