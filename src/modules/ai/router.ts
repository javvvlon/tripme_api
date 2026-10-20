import { transcriptOf } from '~/shared/ai/chat'
import type { IChatTurn } from '~/shared/ai/chat'
import { TRUTH_RULES } from '~/shared/ai/truth'
import { looksLikeOffer } from '~/modules/marketing/intake/assistant'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const AI_DOMAINS = ['marketing', 'blog', 'general'] as const

export type AiDomain = typeof AI_DOMAINS[number]

export interface IAiContext {
  domain?: AiDomain
  pending?: string
  post_id?: string
}

export const CLARIFICATION_CHARS = 300

const BLOG = /(стать|блог|blog|article|maqola|рубрик|черновик)/i

const MARKETING = /(подборк|баннер|реклам|телеграм|telegram|t\.me\/|канал|объявлени|сторис|видеоролик|ролик|selection|banner|advert|\bads?\b|instagram|инстаграм|kanal|reklama|tanlov|e[’']?lon)/i

export function contextOf(raw: unknown): IAiContext {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}

  return {
    domain: AI_DOMAINS.includes(input.domain as AiDomain) ? input.domain as AiDomain : undefined,
    pending: typeof input.pending === 'string' && input.pending.trim() ? input.pending.slice(0, 4000) : undefined,
    post_id: typeof input.post_id === 'string' && input.post_id ? input.post_id : undefined,
  }
}

export function routeOf(text: string, image: boolean, context: IAiContext): AiDomain | null {
  if (image || looksLikeOffer(text, false)) return 'marketing'

  if (context.pending && text.length < CLARIFICATION_CHARS && !BLOG.test(text)) return 'marketing'

  if (BLOG.test(text)) return 'blog'

  if (MARKETING.test(text)) return 'marketing'

  if (context.domain === 'blog' || context.domain === 'marketing') return context.domain

  return null
}

export function handoffOf(raw: unknown): AiDomain {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}

  return input.route === 'blog' || input.route === 'marketing' ? input.route : 'general'
}

export const tripmeSystem = (voice: string): string => [
  'You are TripMe AI, the assistant inside the staff CMS of tripme.uz, a tour agency in Uzbekistan. You talk with managers, agents and marketers.',
  'What TripMe AI can do: build an ad selection from a tour operator\'s post (pasted text, a public t.me link or a screenshot) or from the agency\'s own offer, and then make banners, a Telegram post and a 15-second video in the studio; write a blog article in Russian, Uzbek and English with pictures, revise a draft or suggest topics; give advice on ads, posts, campaigns and site content.',
  'Answer in the language of the last staff message (Russian, Uzbek or English). Be brief and concrete: 2–6 sentences or a short list. Use the formal «Вы». Never use emoji: TripMe has a zero-emoji policy (KNB-MKT-004).',
  'Hand the task over instead of answering when the staff member asks to write, revise or plan a blog article: return {"route": "blog"} and nothing else. When they share a tour offer or ask to build an ad selection, banners or a Telegram post from an offer, return {"route": "marketing"} and nothing else.',
  TRUTH_RULES,
  `TripMe voice:\n${voice}`,
  'Otherwise return JSON only: {"reply": "...", "suggestions": ["...", "..."]}. suggestions are up to 3 short next messages the staff member might send, in the same language.',
].join('\n\n')

export const tripmePrompt = (text: string, history: IChatTurn[]): string => [
  history.length ? `Conversation so far:\n${transcriptOf(history)}` : '',
  `Staff: ${text}`,
].filter(Boolean).join('\n\n')
