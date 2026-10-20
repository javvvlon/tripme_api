import { describe, expect, it } from 'vitest'
import { historyOf, MAX_TURNS, replyOf, withoutEmoji } from './chat'
import { TRUTH_RULES } from './truth'
import { marketingSystem } from '~/modules/marketing/intake/assistant'
import { blogSystem } from '~/modules/posts/assistant/blog.assistant'
import { systemPrompt } from '~/modules/marketing/ai/copywriter'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
describe('assistant chat helpers', () => {
  it('keeps only real turns, newest last', () => {
    const turns = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `m${i}` }))
    const history = historyOf(JSON.stringify([...turns, { role: 'system', text: 'x' }, { role: 'user', text: '  ' }]))

    expect(history).toHaveLength(MAX_TURNS)
    expect(history.at(-1)).toEqual({ role: 'assistant', text: 'm11' })
    expect(historyOf('not json')).toEqual([])
  })

  it('cleans the model reply', () => {
    expect(replyOf({ reply: 'Готово 🔥 ', suggestions: ['Ещё 🌴', '', 'A', 'B', 'C'] })).toEqual({ reply: 'Готово', suggestions: ['Ещё', 'A', 'B'] })
    expect(withoutEmoji('Дубай ✈️ зимой')).toBe('Дубай зимой')
  })
})

describe('truth standard', () => {
  it('sits in every assistant prompt', () => {
    expect(TRUTH_RULES).toContain('Never agree with a false premise')
    expect(marketingSystem('Голос')).toContain(TRUTH_RULES)
    expect(blogSystem('Голос')).toContain(TRUTH_RULES)
    expect(systemPrompt('Голос')).toContain(TRUTH_RULES)
  })
})
