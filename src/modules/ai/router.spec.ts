import { describe, expect, it } from 'vitest'
import { contextOf, handoffOf, routeOf, tripmeSystem } from './router'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const fresh = contextOf({})

describe('TripMe AI routing', () => {
  it('sends operator offers, links and screenshots to marketing', () => {
    expect(routeOf('Rixos Premium 5* HB 7 ночей от 1250$ вылет 12.11', false, fresh)).toBe('marketing')
    expect(routeOf('https://t.me/mascantravel/11143', false, fresh)).toBe('marketing')
    expect(routeOf('', true, fresh)).toBe('marketing')
    expect(routeOf('Сделай подборку по Египту на ноябрь', false, fresh)).toBe('marketing')
  })

  it('sends articles to the blog, even when an offer is waiting for a country', () => {
    expect(routeOf('Напиши статью про Самарканд', false, fresh)).toBe('blog')
    expect(routeOf('Какие темы взять для блога?', false, fresh)).toBe('blog')
    expect(routeOf('Напиши статью про Самарканд', false, contextOf({ pending: 'пост оператора', domain: 'marketing' }))).toBe('blog')
  })

  it('keeps an article request in the blog even with a link and prices in it', () => {
    const ask = 'Напиши статью для блога: eSIM для Турции. Промокод TRIPME, ссылка https://esimo.sng.link/Dfwtk/8ix7/gg0w. 1 ГБ на 7 дней — 3,9 $, безлимит на 7 дней — 26,9 $'

    expect(routeOf(ask, false, fresh)).toBe('blog')
    expect(routeOf('Blog uchun maqola yozing: Turkiya uchun eSIM', false, fresh)).toBe('blog')
    expect(routeOf('Rixos Premium 5* HB 7 ночей от 1250$ — сделай рекламу', false, fresh)).toBe('marketing')
  })

  it('treats a short answer as the clarification marketing asked for', () => {
    expect(routeOf('Турция', false, contextOf({ pending: 'Белек 5* 7 ночей от 890$', domain: 'marketing' }))).toBe('marketing')
  })

  it('stays with the last assistant when the message has no cues', () => {
    expect(routeOf('Сделай короче и добавь совет', false, contextOf({ domain: 'blog', post_id: 'abc' }))).toBe('blog')
    expect(routeOf('Сделай короче и добавь совет', false, contextOf({ domain: 'marketing' }))).toBe('marketing')
  })

  it('lets the general answer hand a task over when nothing decides', () => {
    expect(routeOf('Привет! Что ты умеешь?', false, fresh)).toBeNull()
    expect(handoffOf({ route: 'blog' })).toBe('blog')
    expect(handoffOf({ route: 'marketing' })).toBe('marketing')
    expect(handoffOf({ route: 'weather', reply: 'Тепло' })).toBe('general')
    expect(handoffOf(null)).toBe('general')
  })

  it('reads only known context fields', () => {
    expect(contextOf({ domain: 'sales', pending: '  ', post_id: 7 })).toEqual({ domain: undefined, pending: undefined, post_id: undefined })
  })

  it('describes both skills and keeps the house rules', () => {
    const system = tripmeSystem('Голос')

    expect(system).toContain('ad selection')
    expect(system).toContain('blog article')
    expect(system).toContain('zero-emoji')
    expect(system).toContain('{"route": "blog"}')
    expect(system).toContain('Truth Standard')
  })

  it('sends image requests and their follow-ups to the image studio', () => {
    expect(routeOf('Сгенерируй нейтральный фон с листьями 1920×765', false, fresh)).toBe('image')
    expect(routeOf('Сделай похожую картинку', true, fresh)).toBe('image')
    expect(routeOf('сделай светлее и ещё один вариант', false, contextOf({ domain: 'image' }))).toBe('image')
    expect(routeOf('Напиши статью про Самарканд', false, contextOf({ domain: 'image' }))).toBe('blog')
    expect(routeOf('Сделай подборку по Египту на ноябрь', false, contextOf({ domain: 'image' }))).toBe('marketing')
    expect(handoffOf({ route: 'image' })).toBe('image')
  })
})
