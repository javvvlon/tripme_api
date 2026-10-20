import { createHmac, timingSafeEqual } from 'node:crypto'
import type { IIntakeReport, SkipReason } from './post'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const LINK_TTL_S = 15 * 60

export const HOURLY_POSTS = 20

export const MIN_POST_CHARS = 15

export interface ITelegramUser {
  id: number
  is_bot?: boolean
  username?: string
  first_name?: string
}

export interface ITelegramPhoto {
  file_id: string
  file_size?: number
  width: number
  height: number
}

export interface ITelegramMessage {
  message_id: number
  chat: { id: number, type: string }
  from?: ITelegramUser
  text?: string
  caption?: string
  photo?: ITelegramPhoto[]
  document?: { file_id: string, mime_type?: string, file_size?: number }
  media_group_id?: string
  forward_origin?: {
    type: string
    chat?: { title?: string, username?: string }
    sender_chat?: { title?: string, username?: string }
    sender_user?: { first_name?: string, username?: string }
    sender_user_name?: string
  }
}

export interface ITelegramUpdate {
  update_id: number
  message?: ITelegramMessage
}

const sign = (body: string, secret: string): string =>
  createHmac('sha256', secret).update(body).digest('base64url').slice(0, 12)

export function linkCode(userId: string, secret: string, now = Date.now()): string {
  const body = `${userId.replace(/-/g, '').toLowerCase()}${Math.floor(now / 1000 + LINK_TTL_S).toString(36)}`

  return `${body}_${sign(body, secret)}`
}

export function userOfCode(code: string, secret: string, now = Date.now()): string | null {
  const match = /^([0-9a-f]{32})([0-9a-z]{1,8})_([A-Za-z0-9_-]{12})$/.exec(code)

  if (!match || !secret) return null

  const [, id, expiry, signature] = match as unknown as [string, string, string, string]
  const expected = Buffer.from(sign(`${id}${expiry}`, secret))
  const given = Buffer.from(signature)

  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  if (parseInt(expiry, 36) * 1000 < now) return null

  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`
}

export function sameSecret(given: string | undefined, secret: string): boolean {
  if (!secret || !given) return false

  const a = Buffer.from(given)
  const b = Buffer.from(secret)

  return a.length === b.length && timingSafeEqual(a, b)
}

export function originOf(message: ITelegramMessage): string {
  const origin = message.forward_origin

  if (!origin) return ''

  const chat = origin.chat ?? origin.sender_chat

  return [chat?.title, chat?.username ? `@${chat.username}` : '', origin.sender_user_name, origin.sender_user?.first_name, origin.sender_user?.username ? `@${origin.sender_user.username}` : '']
    .filter(Boolean).join(' ').slice(0, 120)
}

export function pictureOf(message: ITelegramMessage, maxBytes: number): string | null {
  const photo = [...(message.photo ?? [])].sort((a, b) => b.width * b.height - a.width * a.height)[0]

  if (photo && (photo.file_size ?? 0) <= maxBytes) return photo.file_id

  const document = message.document

  if (document && /^image\/(png|jpe?g|webp)$/i.test(document.mime_type ?? '') && (document.file_size ?? 0) <= maxBytes) return document.file_id

  return null
}

export const BOT_TEXT = {
  intro: 'Этот бот принимает посты туроператоров от сотрудников TripMe. Подключите его в CMS: Маркетинг → ИИ-помощник.',
  linked: (name: string) => `Готово${name ? `, ${name}` : ''}. Пересылайте сюда посты туроператоров или скриншоты предложений — я соберу из них подборку в студии.`,
  expired: 'Ссылка для подключения устарела или неверна. Получите новую в CMS: Маркетинг → ИИ-помощник.',
  stopped: 'Бот отключён от Вашего аккаунта.',
  short: 'Пришлите текст поста туроператора или скриншот предложения.',
  limit: 'Слишком много постов за час. Попробуйте позже.',
  working: 'Принял. Читаю пост и ищу эти отели у туроператоров — это займёт до минуты.',
  failed: 'Не получилось разобрать пост. Попробуйте ещё раз через минуту.',
  open: 'Открыть в студии',
}

const REASONS: Record<SkipReason, string> = {
  no_price: 'нет цены',
  no_date: 'нет даты вылета',
  no_nights: 'не указано число ночей',
  limit: 'в подборке уже 6 туров',
}

export function reportText(title: string, report: IIntakeReport, hotels: number): string {
  const skipped = report.skipped.map(item => `— ${item.hotel}: ${REASONS[item.reason]}`)

  if (!report.found && !report.kept) {
    const reason = !report.country ? 'Не понял, о какой стране пост.' : !hotels ? 'В посте нет отелей.' : 'Ни один отель не удалось добавить:'

    return ['Подборку собрать не получилось.', reason, ...skipped].join('\n')
  }

  return [
    `Подборка «${title}» готова.`,
    `Найдено в поиске с ценами на сегодня: ${report.found}`,
    `По цене из поста: ${report.kept}`,
    ...(skipped.length ? ['Не вошли:', ...skipped] : []),
  ].join('\n')
}
