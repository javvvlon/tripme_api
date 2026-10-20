/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const TEMPLATE_OPTIONS = {
  layout: ['stack', 'poster', 'split', 'card'],
  align: ['left', 'center'],
  headline: ['s', 'm', 'l', 'xl'],
  case: ['upper', 'title'],
  kicker: ['pill', 'text', 'none'],
  list: ['rows', 'cards', 'minimal'],
  price: ['inline', 'hero'],
  accent: ['none', 'line', 'frame', 'corner'],
  overlay: ['bottom', 'full', 'top'],
  spacing: ['tight', 'normal', 'airy'],
  cta: ['pill', 'text', 'none'],
} as const

type Options = typeof TEMPLATE_OPTIONS

export type IAdTemplate = { name: string, dim: number } & { [K in keyof Options]: Options[K][number] }

export const DEFAULT_TEMPLATE: IAdTemplate = {
  name: 'TripMe',
  layout: 'stack',
  align: 'left',
  headline: 'l',
  case: 'upper',
  kicker: 'pill',
  list: 'rows',
  price: 'inline',
  accent: 'none',
  overlay: 'bottom',
  dim: 55,
  spacing: 'normal',
  cta: 'pill',
}

export const MAX_TEMPLATE_NAME = 24

export const TEMPLATES_PER_RUN = 4

const HAS_EMOJI = /\p{Extended_Pictographic}/u

const pick = <K extends keyof Options>(key: K, value: unknown): Options[K][number] =>
  (TEMPLATE_OPTIONS[key] as readonly string[]).includes(value as string) ? value as Options[K][number] : DEFAULT_TEMPLATE[key]

export function templateOf(raw: unknown): IAdTemplate | null {
  if (!raw || typeof raw !== 'object') return null

  const input = raw as Record<string, unknown>
  const name = typeof input.name === 'string' ? input.name.replace(/\s+/g, ' ').trim().slice(0, MAX_TEMPLATE_NAME) : ''
  const dim = Math.round(Number(input.dim))

  return {
    name: name && !HAS_EMOJI.test(name) ? name : DEFAULT_TEMPLATE.name,
    layout: pick('layout', input.layout),
    align: pick('align', input.align),
    headline: pick('headline', input.headline),
    case: pick('case', input.case),
    kicker: pick('kicker', input.kicker),
    list: pick('list', input.list),
    price: pick('price', input.price),
    accent: pick('accent', input.accent),
    overlay: pick('overlay', input.overlay),
    dim: Number.isFinite(dim) ? Math.min(90, Math.max(20, dim)) : DEFAULT_TEMPLATE.dim,
    spacing: pick('spacing', input.spacing),
    cta: pick('cta', input.cta),
  }
}

export const sameTemplate = (a: IAdTemplate, b: IAdTemplate): boolean =>
  (Object.keys(TEMPLATE_OPTIONS) as Array<keyof Options>).every(key => a[key] === b[key]) && a.dim === b.dim

export function templatesOf(raw: unknown): IAdTemplate[] {
  const list = Array.isArray(raw) ? raw : []
  const templates: IAdTemplate[] = []

  for (const item of list) {
    const template = templateOf(item)

    if (template && !templates.some(other => sameTemplate(other, template))) templates.push(template)

    if (templates.length === TEMPLATES_PER_RUN) break
  }

  return templates
}

export const DEFAULT_VISUAL = [
  'Визуальный стиль TripMe — «Dark Premium»:',
  '— Тёмный фон, светлый текст, много воздуха; ничего лишнего.',
  '— Заголовки Montserrat, текст Nunito; крупный уверенный заголовок.',
  '— Оранжевый — только кнопка действия. Золото — плашки, звёзды и тонкие акценты.',
  '— Рамки и линии тонкие и золотые, без перегруза.',
  '— Никаких эмодзи, восклицательных знаков, таймеров и «осталось два места».',
  '— Цены читаются сразу: понятный список отелей и одна кнопка.',
].join('\n')

export const TEMPLATE_RULES = [
  'You design advertising banner templates for TripMe (tripme.uz), a tour service in Uzbekistan.',
  'You never draw anything: you return JSON specs that TripMe\'s renderer turns into banners for stories (9:16), posts (4:5) and squares (1:1).',
  'Colours, fonts and the logo are fixed by the renderer; you only choose composition. Return JSON only.',
  'Fields and allowed values:',
  '- "name": a short Russian name for the template, one or two words, no emoji.',
  '- "layout": "stack" (content stacked at the bottom over the background), "poster" (big headline at the top, prices at the bottom), "split" (background on top, solid dark panel with content below), "card" (content inside a floating dark card).',
  '- "align": "left" or "center".',
  '- "headline": size "s", "m", "l" or "xl". "case": "upper" or "title".',
  '- "kicker": the small label above the headline — "pill", "text" or "none".',
  '- "list": hotel prices as "rows" (lines with dividers), "cards" (each hotel in its own dark card) or "minimal" (one quiet line per hotel).',
  '- "price": "inline" (prices only in the list) or "hero" (the lowest price shown large).',
  '- "accent": "none", "line" (thin gold line above the headline), "frame" (thin gold frame around the banner) or "corner" (gold corner brackets).',
  '- "overlay": how the background is darkened — "bottom", "full" or "top". "dim": darkening strength from 20 to 90.',
  '- "spacing": "tight", "normal" or "airy". "cta": the action button as "pill", "text", or "none" (no button, only the site address) when the visual style asks for banners without a button.',
  `Return exactly ${TEMPLATES_PER_RUN} clearly different templates; vary layout first.`,
].join('\n')

export const templateSystem = (visual: string): string =>
  `${TEMPLATE_RULES}\n\nTripMe visual style — follow it exactly:\n${visual.trim() || DEFAULT_VISUAL}`

export function templatePrompt(facts: { destination: string, hot: boolean, hotels: number, avoid: string[] }): string {
  const shape = { templates: Array.from({ length: TEMPLATES_PER_RUN }, () => ({ ...DEFAULT_TEMPLATE, name: '' })) }

  return [
    `Return exactly this JSON shape: ${JSON.stringify(shape)}`,
    `The selection: ${JSON.stringify({ destination: facts.destination, hot: facts.hot, hotels: facts.hotels })}`,
    facts.avoid.length ? `Avoid repeating these existing template names: ${facts.avoid.join(', ')}` : '',
  ].filter(Boolean).join('\n')
}
