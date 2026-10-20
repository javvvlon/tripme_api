/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IChatTurn {
  role: 'user' | 'assistant'
  text: string
}

export const MAX_TURNS = 8

export const MAX_TURN_CHARS = 1500

export const MAX_SUGGESTIONS = 3

const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu

export const withoutEmoji = (value: string): string => value.replace(EMOJI, '').replace(/[ \t]{2,}/g, ' ')

const plain = (value: unknown, max: number): string =>
  typeof value === 'string' ? withoutEmoji(value).trim().slice(0, max) : ''

export function historyOf(raw: unknown): IChatTurn[] {
  let list: unknown = raw

  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw)
    }
    catch {
      list = []
    }
  }

  if (!Array.isArray(list)) return []

  return list
    .map((item) => {
      const turn = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      const role = turn.role === 'assistant' ? 'assistant' : turn.role === 'user' ? 'user' : null
      const text = typeof turn.text === 'string' ? turn.text.trim().slice(0, MAX_TURN_CHARS) : ''

      return role && text ? { role, text } : null
    })
    .filter((turn): turn is IChatTurn => Boolean(turn))
    .slice(-MAX_TURNS)
}

export const transcriptOf = (turns: IChatTurn[]): string =>
  turns.map(turn => `${turn.role === 'user' ? 'Staff' : 'Assistant'}: ${turn.text}`).join('\n\n')

export function replyOf(raw: unknown, options: { emoji?: boolean } = {}): { reply: string, suggestions: string[] } {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const suggestions = (Array.isArray(input.suggestions) ? input.suggestions : [])
    .map(item => plain(item, 90))
    .filter(Boolean)
    .slice(0, MAX_SUGGESTIONS)
  const reply = options.emoji
    ? (typeof input.reply === 'string' ? input.reply.trim().slice(0, 3000) : '')
    : plain(input.reply, 3000)

  return { reply, suggestions }
}
