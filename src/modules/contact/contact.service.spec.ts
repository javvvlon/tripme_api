import { describe, expect, it } from 'vitest'
import { commentOf } from './contact.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */

describe('commentOf', () => {
  it('puts the beta feedback category in front of the message', () => {
    expect(commentOf({ topic: 'beta', category: 'BUG', message: 'Фильтр не сбрасывается' }))
      .toBe('[Техническая ошибка] Фильтр не сбрасывается')
    expect(commentOf({ topic: 'beta', category: 'IDEA', message: 'Тёмная карта' }))
      .toBe('[Идея / пожелание] Тёмная карта')
  })

  it('leaves the message alone without a known category or outside beta', () => {
    expect(commentOf({ topic: 'beta', message: 'Без темы' })).toBe('Без темы')
    expect(commentOf({ topic: 'beta', category: 'constructor', message: 'x' })).toBe('x')
    expect(commentOf({ category: 'BUG', message: 'Обычный вопрос' })).toBe('Обычный вопрос')
  })
})
