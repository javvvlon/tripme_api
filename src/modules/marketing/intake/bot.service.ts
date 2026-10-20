import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import type { OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, Not } from 'typeorm'
import type { Repository } from 'typeorm'
import { UserEntity } from '~/modules/auth/entities'
import { UserRole } from '~/modules/auth/contracts/auth'
import { siteUrl } from '~/modules/esim/esim.links'
import { MarketingBotLinkEntity } from '../selection.entity'
import { MarketingService } from '../marketing.service'
import { MAX_DOWNLOAD_BYTES, TelegramPublisher } from '../telegram.publisher'
import { BOT_TEXT, HOURLY_POSTS, linkCode, MIN_POST_CHARS, originOf, pictureOf, reportText, sameSecret, userOfCode } from './bot'
import type { ITelegramMessage, ITelegramUpdate } from './bot'
import { postLinkOf } from './link'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IBotStatus {
  available: boolean
  username: string
  linked: { username: string, linked_at: string } | null
}

export interface IBotLink {
  url: string
  expires_at: string
}

const MARKETING_ROLES = [UserRole.Agent, UserRole.Manager, UserRole.Admin]

const SEEN_UPDATES = 500

const HOUR_MS = 3_600_000

@Injectable()
export class BotIntakeService implements OnModuleInit {
  private readonly logger = new Logger(BotIntakeService.name)

  private readonly secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? ''

  private readonly webhookUrl = process.env.TELEGRAM_WEBHOOK_URL ?? ''

  private readonly seen = new Set<number>()

  private readonly posts = new Map<string, number[]>()

  constructor(
    @InjectRepository(MarketingBotLinkEntity) private readonly links: Repository<MarketingBotLinkEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly telegram: TelegramPublisher,
    private readonly marketing: MarketingService,
  ) {}

  get available(): boolean {
    return Boolean(this.telegram.hasToken && this.secret)
  }

  onModuleInit(): void {
    if (!this.available || !this.webhookUrl) return

    void this.telegram.setWebhook(this.webhookUrl, this.secret)
      .then(() => this.logger.log('telegram intake webhook is set'))
      .catch((error: unknown) => this.logger.warn(`telegram intake webhook failed: ${String(error)}`))
  }

  trusted(header: string | undefined): boolean {
    return this.available && sameSecret(header, this.secret)
  }

  async status(userId: string): Promise<IBotStatus> {
    const link = await this.links.findOne({ where: { userId, archivedAt: IsNull() } })

    return {
      available: this.available,
      username: this.available ? await this.telegram.botName().catch(() => '') : '',
      linked: link ? { username: link.username, linked_at: link.linkedAt.toISOString() } : null,
    }
  }

  async link(userId: string): Promise<IBotLink> {
    if (!this.available) throw new ServiceUnavailableException('The Telegram bot is not connected')

    const username = await this.telegram.botName()

    if (!username) throw new ServiceUnavailableException('The Telegram bot has no username')

    const now = Date.now()

    return {
      url: `https://t.me/${username}?start=${linkCode(userId, this.secret, now)}`,
      expires_at: new Date(now + 15 * 60_000).toISOString(),
    }
  }

  async unlink(userId: string): Promise<IBotStatus> {
    await this.links.update({ userId, archivedAt: IsNull() }, { archivedAt: new Date() })

    return this.status(userId)
  }

  async handle(update: ITelegramUpdate): Promise<void> {
    if (this.seen.has(update.update_id)) return

    this.seen.add(update.update_id)

    if (this.seen.size > SEEN_UPDATES) this.seen.delete(this.seen.values().next().value as number)

    const message = update.message

    if (!message?.from || message.from.is_bot || message.chat.type !== 'private') return

    try {
      await this.message(message)
    }
    catch (error) {
      this.logger.warn(`telegram intake ${message.chat.id}: ${String(error)}`)
      await this.telegram.reply(message.chat.id, BOT_TEXT.failed).catch(() => undefined)
    }
  }

  private async message(message: ITelegramMessage): Promise<void> {
    const from = message.from

    if (!from) return

    const chat = message.chat.id
    const telegramId = String(from.id)
    const text = (message.text ?? message.caption ?? '').trim()

    if (text.startsWith('/start')) {
      const code = text.split(/\s+/)[1] ?? ''

      if (code) {
        await this.telegram.reply(chat, await this.attach(code, telegramId, from.username ?? ''))
        return
      }

      const user = await this.staffOf(telegramId)

      await this.telegram.reply(chat, user ? BOT_TEXT.linked(user.firstName) : BOT_TEXT.intro)
      return
    }

    if (text.startsWith('/stop')) {
      await this.links.update({ telegramId, archivedAt: IsNull() }, { archivedAt: new Date() })
      await this.telegram.reply(chat, BOT_TEXT.stopped)
      return
    }

    const user = await this.staffOf(telegramId)

    if (!user) {
      await this.telegram.reply(chat, BOT_TEXT.intro)
      return
    }

    if (message.media_group_id && !message.caption) return

    const picture = pictureOf(message, MAX_DOWNLOAD_BYTES)

    if (text.length < MIN_POST_CHARS && !picture && !postLinkOf(text)) {
      await this.telegram.reply(chat, BOT_TEXT.short)
      return
    }

    if (!this.allow(user.id)) {
      await this.telegram.reply(chat, BOT_TEXT.limit)
      return
    }

    await this.telegram.reply(chat, BOT_TEXT.working)

    const image = picture ? await this.picture(picture) : null
    const answer = await this.marketing.fromPost({ text, origin: originOf(message), image }, user.id, 'telegram')
    const title = answer.selection?.title ?? answer.report.country
    const hotels = answer.selection?.intake?.facts.hotels.length ?? answer.report.skipped.length

    await this.telegram.reply(
      chat,
      reportText(title, answer.report, hotels),
      answer.selection ? [{ text: BOT_TEXT.open, url: `${siteUrl()}/ru/app/marketing/${answer.selection.id}` }] : [],
    )
  }

  private async attach(code: string, telegramId: string, username: string): Promise<string> {
    const userId = userOfCode(code, this.secret)
    const user = userId ? await this.users.findOne({ where: { id: userId } }) : null

    if (!user || user.archivedAt || !MARKETING_ROLES.includes(user.role)) return BOT_TEXT.expired

    await this.links.update({ userId: user.id, archivedAt: IsNull(), telegramId: Not(telegramId) }, { archivedAt: new Date() })
    await this.links.save(this.links.create({ telegramId, userId: user.id, username: username.slice(0, 64), linkedAt: new Date(), archivedAt: null }))

    return BOT_TEXT.linked(user.firstName)
  }

  private async staffOf(telegramId: string): Promise<UserEntity | null> {
    const link = await this.links.findOne({ where: { telegramId, archivedAt: IsNull() } })
    const user = link ? await this.users.findOne({ where: { id: link.userId } }) : null

    return user && !user.archivedAt && MARKETING_ROLES.includes(user.role) ? user : null
  }

  private allow(userId: string): boolean {
    const now = Date.now()
    const recent = (this.posts.get(userId) ?? []).filter(at => now - at < HOUR_MS)

    if (recent.length >= HOURLY_POSTS) return false

    this.posts.set(userId, [...recent, now])

    return true
  }

  private async picture(fileId: string): Promise<{ mimeType: string, data: Buffer } | null> {
    try {
      const file = await this.telegram.download(fileId)
      const mimeType = /\.png$/i.test(file.path) ? 'image/png' : /\.webp$/i.test(file.path) ? 'image/webp' : 'image/jpeg'

      return { mimeType, data: file.buffer }
    }
    catch (error) {
      this.logger.warn(`telegram intake picture: ${String(error)}`)

      return null
    }
  }
}
