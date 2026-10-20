import { transcriptOf } from '~/shared/ai/chat'
import type { IChatTurn } from '~/shared/ai/chat'
import { isPrivateLink, postLinkOf } from './link'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const PRICE = /(\d[\d\s.,]{1,}\s*(\$|usd|у\.?\s?е\.?|eur|€|сум|so['‘’]?m))|(\$\s?\d{2,})/i

const TOUR_WORDS = /(\d\s*(\*|★)|отел|hotel|resort|ноч|night|kecha|вылет|uchish|питани|завтрак|всё включено|all inclusive|\b(bb|hb|fb|ai|uai)\b)/i

export function looksLikeOffer(text: string, image: boolean): boolean {
  const value = text.trim()

  if (image || postLinkOf(value) || isPrivateLink(value)) return true

  return PRICE.test(value) && TOUR_WORDS.test(value)
}

export const marketingSystem = (voice: string): string => [
  'You are TripMe\'s marketing assistant inside the staff CMS of tripme.uz, a tour agency in Uzbekistan. You talk with managers and marketers.',
  'What this chat can do: build an ad selection from a tour operator\'s post (pasted text, a public t.me link or a screenshot); the studio then makes banners, a Telegram post and a 15-second video. Staff can also connect their Telegram and forward operator posts to the bot. And you give advice on ads, Telegram posts and campaigns.',
  'When the staff member wants a selection but sent no offer, ask them to paste the operator\'s post, its t.me link or a screenshot.',
  'Answer in the language of the last staff message (Russian, Uzbek or English). Be brief and concrete: 2–6 sentences or a short list. Use the formal «Вы». Use emoji only when the TripMe voice below asks for them. Never invent prices, dates, availability or visa rules.',
  `TripMe voice:\n${voice}`,
  'Return JSON only: {"reply": "...", "suggestions": ["...", "..."]}. suggestions are up to 3 short next messages the staff member might send, in the same language.',
].join('\n\n')

export function marketingPrompt(text: string, history: IChatTurn[]): string {
  return [
    history.length ? `Conversation so far:\n${transcriptOf(history)}` : '',
    `Staff: ${text}`,
  ].filter(Boolean).join('\n\n')
}
