import { transcriptOf } from '~/shared/ai/chat'
import type { IChatTurn } from '~/shared/ai/chat'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const IMAGE_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const

export type ImageRatio = typeof IMAGE_RATIOS[number]

export type ImageFormat = 'jpeg' | 'png' | 'webp'

export const IMAGE_FOLDER = 'TripMe AI'

export const MAX_IMAGES = 4

export const MIN_SIDE = 256

export const MAX_SIDE = 4096

export const DEFAULT_SIZE = { width: 1920, height: 1080 } as const

export interface IImageSpec {
  prompt: string
  title: string
  reply: string
  width: number
  height: number
  count: number
  format: ImageFormat
  suggestions: string[]
}

export const IMAGE_ASK = /((сгенерир|генерир|нарису|рисун|созда|сдела|подбер|generate|draw|create|make|render|chiz|yarat).{0,40}(картин|изображен|иллюстрац|фото|фон|обложк|текстур|image|picture|illustration|photo|background|wallpaper|texture|rasm|surat|fon))|((картин|изображен|иллюстрац|image|picture|rasm|surat|\bfon).{0,30}(сгенерир|нарису|generate|draw|chiz|yarat|yasa))/i

export function closestRatio(width: number, height: number): ImageRatio {
  const wanted = Math.log(width / height)

  return IMAGE_RATIOS.reduce((best, ratio) => {
    const [w, h] = ratio.split(':').map(Number) as [number, number]
    const [bw, bh] = best.split(':').map(Number) as [number, number]

    return Math.abs(Math.log(w / h) - wanted) < Math.abs(Math.log(bw / bh) - wanted) ? ratio : best
  }, IMAGE_RATIOS[0] as ImageRatio)
}

export function imageSizeFor(width: number, height: number): '1K' | '2K' | '4K' {
  const side = Math.max(width, height)

  if (side <= 1024) return '1K'

  return side <= 2048 ? '2K' : '4K'
}

const side = (value: unknown): number | null => {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(/\D/g, '')) : Number.NaN

  return Number.isFinite(number) && number > 0 ? Math.min(MAX_SIDE, Math.max(MIN_SIDE, Math.round(number))) : null
}

const text = (value: unknown, limit: number): string =>
  typeof value === 'string' ? value.trim().slice(0, limit) : ''

export function imageSpecOf(raw: unknown): IImageSpec | null {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const prompt = text(input.prompt, 4000)

  if (!prompt) return null

  const width = side(input.width)
  const height = side(input.height)
  const count = Math.min(MAX_IMAGES, Math.max(1, Math.round(Number(input.count) || 1)))
  const format = input.format === 'png' || input.format === 'webp' ? input.format : 'jpeg'
  const suggestions = Array.isArray(input.suggestions)
    ? input.suggestions.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim())).map(entry => entry.trim().slice(0, 120)).slice(0, 3)
    : []

  return {
    prompt,
    title: text(input.title, 80) || 'TripMe AI',
    reply: text(input.reply, 600),
    width: width ?? (height ? Math.round(height * DEFAULT_SIZE.width / DEFAULT_SIZE.height) : DEFAULT_SIZE.width),
    height: height ?? (width ? Math.round(width * DEFAULT_SIZE.height / DEFAULT_SIZE.width) : DEFAULT_SIZE.height),
    count,
    format,
    suggestions,
  }
}

export const TRIPME_IMAGE_STYLE = [
  'TripMe house style for site and marketing imagery, unless the staff member clearly asks for something else:',
  '- calm, neutral and imaginary rather than literal: soft botanical shapes, palm and monstera leaves, leaf shadows on a wall, sand, linen, stone, gentle water, sky and haze;',
  '- warm neutral palette: sand, cream, beige, warm grey and soft graphite, with at most a small accent of TripMe orange (#FF6500);',
  '- soft natural light with gentle depth of field, photographic but slightly dreamlike, premium and quiet;',
  '- generous calm negative space so headlines can sit on top;',
  '- strictly no text, letters, numbers, logos, watermarks, frames or UI elements, and no recognisable faces.',
  'For a dark theme keep the same subjects but make the scene low-key and deep (night, dusk, graphite tones); for a light theme keep it airy and bright.',
].join('\n')

export const IMAGE_SIZES_GUIDE = [
  'Pick width and height in pixels:',
  '- if the staff member gives a size ("1920x1080", "1920 на 1080", "1080 px wide") use it exactly;',
  '- if they give only a ratio ("16:9", "квадрат", "вертикаль"), keep that ratio with the long side 1920 (square 1080x1080);',
  '- otherwise derive it from the purpose: site hero or main screen 1920x765, site banner, «Фото + текст» block or blog cover 1600x900, Instagram post 1080x1350, square post 1080x1080, stories or reels 1080x1920, Telegram post 1280x720;',
  '- with no hint at all use 1920x1080.',
].join('\n')

export const imageSystem = (): string => [
  'You plan image generation for TripMe AI, the assistant in the staff CMS of tripme.uz, a tour agency in Uzbekistan.',
  'Read the staff request (Russian, Uzbek or English) and the conversation, then return JSON only:',
  '{"prompt": "...", "title": "...", "width": 1920, "height": 1080, "count": 1, "format": "jpeg", "reply": "...", "suggestions": ["..."]}.',
  'prompt: a detailed English prompt for the image model that keeps every subject, mood, colour and composition detail the staff asked for. Follow-ups such as "lighter", "another one" or "without the palm" change the previous prompt rather than start over.',
  TRIPME_IMAGE_STYLE,
  IMAGE_SIZES_GUIDE,
  'count: how many variants they asked for, 1 to 4; default 1.',
  'format: "png" or "webp" only when asked, otherwise "jpeg".',
  'title: a short name for the media library in the staff language, e.g. «Листья на песке · 1920×765».',
  'reply: one or two short sentences in the staff language that say what you made and its size, without gendered first-person verbs (write «Готово: два варианта… 1080×1920», not «Я подготовил»). Use the formal «Вы». No emoji.',
  'suggestions: up to 3 short next requests in the same language, such as another variant, a darker version for the dark theme or another size.',
  'If a reference picture is attached, use it for style, palette or composition as the staff asks, and say so in the prompt.',
].join('\n\n')

export const imagePrompt = (text: string, history: IChatTurn[]): string => [
  history.length ? `Conversation so far:\n${transcriptOf(history)}` : '',
  `Staff: ${text}`,
].filter(Boolean).join('\n\n')

export const generationPrompt = (spec: Pick<IImageSpec, 'prompt'>, ratio: ImageRatio, width: number, height: number): string => [
  spec.prompt,
  `Compose for a ${ratio} frame that will be used at exactly ${width}x${height} pixels; keep the main subject away from the edges so a gentle crop does not cut it.`,
  'No text, letters, numbers, logos or watermarks anywhere in the image.',
].join(' ')
