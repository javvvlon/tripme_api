import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { GeminiClient } from '~/shared/ai/gemini.client'
import type { IGeminiImage } from '~/shared/ai/gemini.client'
import { historyOf, replyOf } from '~/shared/ai/chat'
import { MarketingService } from '~/modules/marketing/marketing.service'
import type { IAssistantAnswer } from '~/modules/marketing/marketing.service'
import { MarketingSettingsEntity } from '~/modules/marketing/selection.entity'
import { DEFAULT_VOICE } from '~/modules/marketing/ai/copywriter'
import { BlogAssistantService } from '~/modules/posts/assistant/blog.assistant.service'
import type { IBlogAssistantAnswer } from '~/modules/posts/assistant/blog.assistant.service'
import { contextOf, handoffOf, routeOf, tripmePrompt, tripmeSystem } from './router'
import type { AiDomain } from './router'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IAiInput {
  text?: unknown
  history?: unknown
  context?: unknown
  image: IGeminiImage | null
}

export type IAiAnswer =
  | { domain: 'marketing', text: string, marketing: IAssistantAnswer }
  | { domain: 'blog', blog: IBlogAssistantAnswer }
  | { domain: 'general', reply: string, suggestions: string[] }

const MAX_TEXT = 4000

@Injectable()
export class AiService {
  constructor(
    private readonly marketing: MarketingService,
    private readonly blog: BlogAssistantService,
    private readonly gemini: GeminiClient,
    @InjectRepository(MarketingSettingsEntity) private readonly settings: Repository<MarketingSettingsEntity>,
  ) {}

  async ask(input: IAiInput, actorId: string): Promise<IAiAnswer> {
    const text = typeof input.text === 'string' ? input.text.trim().slice(0, MAX_TEXT) : ''

    if (!text && !input.image) throw new BadRequestException('Write what you need')

    const context = contextOf(typeof input.context === 'string' ? safeJson(input.context) : input.context)
    const history = historyOf(input.history)
    const routed = routeOf(text, Boolean(input.image), context)
    const general = routed ? null : await this.general(text, history)
    const domain: AiDomain = routed ?? general!.domain

    if (domain === 'marketing') {
      const said = context.pending && !input.image ? `${context.pending}\n\n${text}` : text

      return { domain, text: said, marketing: await this.marketing.assist({ text: said, image: input.image, history }, actorId) }
    }

    if (domain === 'blog') return { domain, blog: await this.blog.assist({ text, history, post_id: context.post_id }, actorId) }

    return { domain: 'general', reply: general?.reply ?? '', suggestions: general?.suggestions ?? [] }
  }

  private async general(text: string, history: ReturnType<typeof historyOf>): Promise<{ domain: AiDomain, reply: string, suggestions: string[] }> {
    if (!this.gemini.configured) throw new ServiceUnavailableException('GEMINI_API_KEY is not set')

    const stored = await this.settings.findOne({ where: { id: 1 } })
    const raw = await this.gemini.json<unknown>(tripmeSystem(stored?.voice.trim() || DEFAULT_VOICE), tripmePrompt(text, history), { temperature: 0.5 })

    return { domain: handoffOf(raw), ...replyOf(raw) }
  }
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value)
  }
  catch {
    return null
  }
}
