import { BadGatewayException, BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { MAX_IMAGE_BYTES } from '~/shared/storage/storage.service'
import type { IUploadedFile } from '~/shared/storage/storage.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const CAPTION_LIMIT = 1024

export const MESSAGE_LIMIT = 4096

export interface ITelegramButton {
  text: string
  url: string
}

export interface ITelegramMedia {
  buffer: Buffer
  mimeType: string
  kind: 'photo' | 'video'
  width?: number
  height?: number
  duration?: number
}

interface ITelegramAnswer<T> {
  ok: boolean
  description?: string
  result?: T
}

export const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024

export interface IPublishFiles {
  image?: IUploadedFile[]
  video?: IUploadedFile[]
}

export const MAX_VIDEO_BYTES = 48 * 1024 * 1024

const whole = (value: unknown, max: number): number | undefined => {
  const parsed = Math.round(Number(value))

  return Number.isFinite(parsed) && parsed > 0 && parsed <= max ? parsed : undefined
}

export function mediaOf(files: IPublishFiles, input: { width?: unknown, height?: unknown, duration?: unknown }): ITelegramMedia {
  const video = files.video?.[0]
  const image = files.image?.[0]

  if (video?.buffer?.length) {
    if (video.mimetype !== 'video/mp4') throw new BadRequestException('Attach the video as an MP4')

    return {
      buffer: video.buffer,
      mimeType: video.mimetype,
      kind: 'video',
      width: whole(input.width, 4096),
      height: whole(input.height, 4096),
      duration: whole(input.duration, 600),
    }
  }

  if (!image?.buffer?.length || !['image/png', 'image/jpeg'].includes(image.mimetype)) throw new BadRequestException('Attach the banner as a PNG or JPEG')
  if (image.buffer.length > MAX_IMAGE_BYTES) throw new BadRequestException('The banner is too large')

  return { buffer: image.buffer, mimeType: image.mimetype, kind: 'photo' }
}

export const telegramUrl = (username: string): string => `https://t.me/${username}`

export function usernameOf(value: unknown): string {
  if (typeof value !== 'string') return ''

  const plain = value.trim().replace(/^https?:\/\/(www\.)?(t|telegram)\.me\//i, '').replace(/^@/, '').split(/[/?#]/)[0] ?? ''

  return /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(plain) ? plain : ''
}

export function keyboardOf(buttons: ITelegramButton[], perRow = 2): ITelegramButton[][] {
  const [first, ...rest] = buttons
  const rows: ITelegramButton[][] = first ? [[first]] : []

  for (let i = 0; i < rest.length; i += perRow) rows.push(rest.slice(i, i + perRow))

  return rows
}

@Injectable()
export class TelegramPublisher {
  private readonly logger = new Logger(TelegramPublisher.name)

  private readonly token = process.env.TELEGRAM_BOT_TOKEN ?? ''

  readonly channel = process.env.TELEGRAM_CHANNEL ?? ''

  private username: Promise<string> | null = null

  get configured(): boolean {
    return Boolean(this.token && this.channel)
  }

  get hasToken(): boolean {
    return Boolean(this.token)
  }

  botName(): Promise<string> {
    if (!this.token) return Promise.resolve('')

    this.username ??= this.request<{ username?: string }>('getMe', {})
      .then(me => me.username ?? '')
      .catch((error: unknown) => {
        this.username = null
        throw error
      })

    return this.username
  }

  async reply(chatId: number | string, text: string, buttons: ITelegramButton[] = []): Promise<number> {
    const sent = await this.request<{ message_id: number }>('sendMessage', {
      chat_id: chatId,
      text: text.slice(0, MESSAGE_LIMIT),
      disable_web_page_preview: true,
      ...(buttons.length ? { reply_markup: { inline_keyboard: buttons.map(button => [button]) } } : {}),
    })

    return sent.message_id
  }

  async download(fileId: string): Promise<{ buffer: Buffer, path: string }> {
    const file = await this.request<{ file_path?: string, file_size?: number }>('getFile', { file_id: fileId })

    if (!file.file_path || (file.file_size ?? 0) > MAX_DOWNLOAD_BYTES) throw new BadGatewayException('Telegram file is missing or too large')

    const response = await fetch(`https://api.telegram.org/file/bot${this.token}/${file.file_path}`, { signal: AbortSignal.timeout(60_000) })
      .catch(() => null)

    if (!response?.ok) throw new BadGatewayException('Telegram file could not be downloaded')

    return { buffer: Buffer.from(await response.arrayBuffer()), path: file.file_path }
  }

  async setWebhook(url: string, secret: string): Promise<void> {
    await this.request('setWebhook', { url, secret_token: secret, allowed_updates: ['message'], max_connections: 10 })
  }

  async publish(media: ITelegramMedia, text: string, buttons: ITelegramButton[]): Promise<number> {
    if (!this.configured) throw new ServiceUnavailableException('The Telegram bot is not connected')

    const markup = buttons.length ? JSON.stringify({ inline_keyboard: keyboardOf(buttons) }) : ''

    if (text.length <= CAPTION_LIMIT) return this.media(media, text, markup)

    await this.media(media, '', '')

    const sent = await this.request<{ message_id: number }>('sendMessage', {
      chat_id: this.channel,
      text: text.slice(0, MESSAGE_LIMIT),
      disable_web_page_preview: true,
      ...(markup ? { reply_markup: JSON.parse(markup) as unknown } : {}),
    })

    return sent.message_id
  }

  private media(media: ITelegramMedia, caption: string, markup: string): Promise<number> {
    const form = new FormData()
    const video = media.kind === 'video'
    const name = video ? 'tripme.mp4' : media.mimeType === 'image/jpeg' ? 'tripme.jpg' : 'tripme.png'

    form.append('chat_id', this.channel)
    form.append(media.kind, new Blob([new Uint8Array(media.buffer)], { type: media.mimeType }), name)

    if (video) {
      form.append('supports_streaming', 'true')

      for (const key of ['width', 'height', 'duration'] as const) {
        if (media[key]) form.append(key, String(media[key]))
      }
    }

    if (caption) form.append('caption', caption)
    if (markup) form.append('reply_markup', markup)

    return this.request<{ message_id: number }>(video ? 'sendVideo' : 'sendPhoto', form).then(sent => sent.message_id)
  }

  private async request<T>(method: string, body: FormData | Record<string, unknown>): Promise<T> {
    if (!this.token) throw new ServiceUnavailableException('The Telegram bot is not connected')

    let answer: ITelegramAnswer<T>
    const form = body instanceof FormData

    try {
      const response = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: 'POST',
        headers: form ? undefined : { 'content-type': 'application/json' },
        body: form ? body : JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      })

      answer = await response.json() as ITelegramAnswer<T>
    }
    catch (error) {
      this.logger.warn(`telegram ${method} unreachable: ${String(error).replace(this.token, '***')}`)
      throw new BadGatewayException('Telegram did not answer')
    }

    if (!answer.ok || !answer.result) {
      this.logger.warn(`telegram ${method}: ${answer.description ?? 'failed'}`)
      throw new BadGatewayException(`Telegram refused the request: ${answer.description ?? 'unknown error'}`)
    }

    return answer.result
  }
}
