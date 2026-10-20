import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const CAPTION_LIMIT = 1024

export const MESSAGE_LIMIT = 4096

export interface ITelegramButton {
  text: string
  url: string
}

interface ITelegramAnswer {
  ok: boolean
  description?: string
  result?: { message_id: number }
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

  get configured(): boolean {
    return Boolean(this.token && this.channel)
  }

  async publish(photo: Buffer, mimeType: string, text: string, buttons: ITelegramButton[]): Promise<number> {
    if (!this.configured) throw new ServiceUnavailableException('The Telegram bot is not connected')

    const markup = buttons.length ? JSON.stringify({ inline_keyboard: keyboardOf(buttons) }) : ''

    if (text.length <= CAPTION_LIMIT) return this.photo(photo, mimeType, text, markup)

    await this.photo(photo, mimeType, '', '')

    return this.call('sendMessage', JSON.stringify({
      chat_id: this.channel,
      text: text.slice(0, MESSAGE_LIMIT),
      disable_web_page_preview: true,
      ...(markup ? { reply_markup: JSON.parse(markup) } : {}),
    }), 'application/json')
  }

  private photo(photo: Buffer, mimeType: string, caption: string, markup: string): Promise<number> {
    const form = new FormData()

    form.append('chat_id', this.channel)
    form.append('photo', new Blob([new Uint8Array(photo)], { type: mimeType }), mimeType === 'image/jpeg' ? 'tripme.jpg' : 'tripme.png')

    if (caption) form.append('caption', caption)
    if (markup) form.append('reply_markup', markup)

    return this.call('sendPhoto', form)
  }

  private async call(method: string, body: FormData | string, contentType?: string): Promise<number> {
    let answer: ITelegramAnswer

    try {
      const response = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: 'POST',
        headers: contentType ? { 'content-type': contentType } : undefined,
        body,
        signal: AbortSignal.timeout(60_000),
      })

      answer = await response.json() as ITelegramAnswer
    }
    catch (error) {
      this.logger.warn(`telegram ${method} unreachable: ${String(error).replace(this.token, '***')}`)
      throw new BadGatewayException('Telegram did not answer')
    }

    if (!answer.ok || !answer.result) {
      this.logger.warn(`telegram ${method}: ${answer.description ?? 'failed'}`)
      throw new BadGatewayException(`Telegram refused the post: ${answer.description ?? 'unknown error'}`)
    }

    return answer.result.message_id
  }
}
