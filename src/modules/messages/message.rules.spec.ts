import { describe, expect, it } from 'vitest'
import { AuthorRole, messageBody, unreadFor } from './message.rules'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
describe('messages', () => {
  it('keeps the text, trims the edges and refuses empty or huge ones', () => {
    expect(messageBody('  Здравствуйте!\r\nКогда вылет?  ')).toBe('Здравствуйте!\nКогда вылет?')
    expect(() => messageBody('   ')).toThrow('empty')
    expect(() => messageBody('x'.repeat(2001))).toThrow('2000')
  })

  it('counts what the other side wrote since the reader last looked', () => {
    const at = (minutes: number) => new Date(Date.UTC(2026, 9, 9, 10, minutes))
    const thread = [
      { authorRole: AuthorRole.Client, createdAt: at(1) },
      { authorRole: AuthorRole.Staff, createdAt: at(2) },
      { authorRole: AuthorRole.System, createdAt: at(3) },
      { authorRole: AuthorRole.Client, createdAt: at(4) },
    ]

    expect(unreadFor(thread, 'client', null)).toBe(2)
    expect(unreadFor(thread, 'client', at(2))).toBe(1)
    expect(unreadFor(thread, 'staff', at(1))).toBe(1)
    expect(unreadFor(thread, 'staff', at(5))).toBe(0)
  })
})
