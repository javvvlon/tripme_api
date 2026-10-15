import { describe, expect, it } from 'vitest'
import { BLOCK_RULES, isFeatureIcon, normaliseAnchor, ratingOf, sectionProblem, sectionSettings } from './content.blocks'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const lists = new Map([
  ['cards-list', 'cards'],
  ['faq-list', 'faq'],
  ['features-list', 'features'],
])

describe('sectionProblem', () => {
  it('accepts every block filled from a matching source', () => {
    expect(sectionProblem([
      { kind: 'cards', source: 'list', list_id: 'cards-list', layout_id: 'grid', anchor: 'hot' },
      { kind: 'cards', source: 'posts', layout_id: 'grid' },
      { kind: 'features', source: 'list', list_id: 'features-list' },
      { kind: 'faq', source: 'list', list_id: 'faq-list' },
    ], lists)).toBeNull()
  })

  it('needs a layout only where the block is drawn on a grid', () => {
    expect(sectionProblem([{ kind: 'cards', source: 'list', list_id: 'cards-list' }], lists))
      .toBe('Section 1: pick a layout')
    expect(sectionProblem([{ kind: 'faq', source: 'list', list_id: 'faq-list', layout_id: null }], lists))
      .toBeNull()
  })

  it('refuses posts outside card blocks', () => {
    expect(sectionProblem([{ kind: 'faq', source: 'posts' }], lists))
      .toBe('Section 1: "faq" cannot show "posts"')
  })

  it('refuses a list of another type', () => {
    expect(sectionProblem([{ kind: 'faq', source: 'list', list_id: 'cards-list' }], lists))
      .toBe('Section 1: a "cards" list cannot fill a "faq" section')
  })

  it('refuses a missing list', () => {
    expect(sectionProblem([{ kind: 'features', source: 'list', list_id: 'gone' }], lists))
      .toBe('Section 1: pick a list')
  })

  it('refuses the same anchor twice, however it was typed', () => {
    expect(sectionProblem([
      { kind: 'faq', source: 'list', list_id: 'faq-list', anchor: 'Hot' },
      { kind: 'features', source: 'list', list_id: 'features-list', anchor: ' hot ' },
    ], lists)).toBe('Section 2: anchor "hot" is already used')
  })
})

describe('page builder blocks', () => {
  it('keeps blog-only blocks off the home page', () => {
    expect(sectionProblem([{ kind: 'hero', source: 'none' }], lists, 'home'))
      .toBe('Section 1: "hero" does not belong on the home page')
    expect(sectionProblem([
      { kind: 'hero', source: 'none', translations: [{ title: 'Блог' }] },
      { kind: 'featured', source: 'posts' },
      { kind: 'feed', source: 'posts' },
      { kind: 'faq', source: 'list', list_id: 'faq-list', translations: [{ title: 'FAQ' }] },
    ], lists, 'blog')).toBeNull()
  })

  it('asks for a heading where the block shows one, and not where it is optional', () => {
    expect(sectionProblem([{ kind: 'hero', source: 'none', translations: [{ title: ' ' }] }], lists, 'blog'))
      .toBe('Section 1: needs a heading in at least one language')
    expect(sectionProblem([{ kind: 'feed', source: 'posts', translations: [] }], lists, 'blog')).toBeNull()
  })

  it('cleans block settings', () => {
    expect(sectionSettings('feed', { page_size: 7, exclude_featured: false })).toEqual({ page_size: 9, exclude_featured: false })
    expect(sectionSettings('feed', { page_size: 12 })).toEqual({ page_size: 12, exclude_featured: true })
    expect(sectionSettings('hero', { image_url: '  https://x/1.jpg ', extra: 1 })).toEqual({ image_url: 'https://x/1.jpg' })
    expect(sectionSettings('cards', { page_size: 12 })).toEqual({})
  })
})

describe('rich blocks', () => {
  it('fits on both pages and needs no list', () => {
    for (const page of ['home', 'blog'] as const) {
      expect(sectionProblem([
        { kind: 'banner', source: 'none', translations: [{ title: 'Мальдивы −20%' }] },
        { kind: 'media', source: 'none', translations: [{ title: 'Как мы работаем' }] },
        { kind: 'cta', source: 'none', translations: [{ title: 'Подберём тур' }] },
        { kind: 'quote', source: 'none', translations: [{ title: '', body: 'Лучший отпуск' }] },
        { kind: 'text', source: 'none', translations: [{ title: '', body: 'Текст' }] },
        { kind: 'spotlight', source: 'posts' },
      ], lists, page)).toBeNull()
    }
  })

  it('asks for text where the text is the block', () => {
    expect(sectionProblem([{ kind: 'quote', source: 'none', translations: [{ title: 'Анна', body: ' ' }] }], lists, 'home'))
      .toBe('Section 1: needs text in at least one language')
    expect(sectionProblem([{ kind: 'banner', source: 'none', translations: [{ title: ' ' }] }], lists, 'home'))
      .toBe('Section 1: needs a heading in at least one language')
  })

  it('fills a carousel from a cards list', () => {
    const kinds = new Map([['cards-list', 'cards'], ['faq-list', 'faq']])

    expect(sectionProblem([{ kind: 'carousel', source: 'list', list_id: 'cards-list', translations: [] }], kinds, 'home')).toBeNull()
    expect(sectionProblem([{ kind: 'carousel', source: 'list', list_id: 'faq-list', translations: [] }], kinds, 'home'))
      .toBe('Section 1: a "faq" list cannot fill a "carousel" section')
    expect(sectionProblem([{ kind: 'carousel', source: 'posts', translations: [] }], kinds, 'blog')).toBeNull()
  })

  it('lets a picture stand in for the heading', () => {
    const picture = { image_url: 'https://cdn.test/banner.jpg' }

    expect(sectionProblem([{ kind: 'banner', source: 'none', translations: [], settings: picture }], lists, 'home')).toBeNull()
    expect(sectionProblem([{ kind: 'hero', source: 'none', translations: [{ title: '' }], settings: picture }], lists, 'blog')).toBeNull()
    expect(sectionProblem([{ kind: 'cta', source: 'none', translations: [], settings: picture }], lists, 'home'))
      .toBe('Section 1: needs a heading in at least one language')
  })

  it('keeps only known looks', () => {
    expect(sectionSettings('banner', { image_url: ' https://x/1.jpg ', style: 'wide', tone: 'neon' }))
      .toEqual({ image_url: 'https://x/1.jpg', style: 'wide', tone: 'light' })
    expect(sectionSettings('media', { image_side: 'right' })).toEqual({ image_url: null, image_side: 'right' })
    expect(sectionSettings('cta', {})).toEqual({ tone: 'brand' })
    expect(sectionSettings('spotlight', { list_size: 9 })).toEqual({ list_size: 4 })
    expect(sectionSettings('text', { tone: 'dark' })).toEqual({})
  })
})

describe('home blocks', () => {
  it('keeps the search hero on the home page, once', () => {
    expect(sectionProblem([{ kind: 'search', source: 'none' }, { kind: 'contact', source: 'none' }], lists, 'home')).toBeNull()
    expect(sectionProblem([{ kind: 'search', source: 'none' }], lists, 'blog'))
      .toBe('Section 1: "search" does not belong on the blog page')
    expect(sectionProblem([{ kind: 'search', source: 'none' }, { kind: 'search', source: 'none' }], lists, 'home'))
      .toBe('Section 2: a page can hold only one "search" block')
  })

  it('keeps only the photo of a search hero', () => {
    expect(sectionSettings('search', { image_url: ' https://x/h.jpg ', tone: 'dark' })).toEqual({ image_url: 'https://x/h.jpg', accent: 'pill' })
    expect(sectionSettings('search', { accent: 'gold' })).toEqual({ image_url: null, accent: 'gold' })
    expect(sectionSettings('search', { accent: 'neon' })).toEqual({ image_url: null, accent: 'pill' })
    expect(sectionSettings('contact', { image_url: 'https://x/h.jpg' })).toEqual({})
  })
})

describe('reviews', () => {
  it('fills a reviews block only from a reviews list', () => {
    const kinds = new Map([['reviews-list', 'reviews'], ['cards-list', 'cards']])
    const titled = [{ title: 'Отзывы' }]

    expect(sectionProblem([{ kind: 'reviews', source: 'list', list_id: 'reviews-list', translations: titled }], kinds, 'home')).toBeNull()
    expect(sectionProblem([{ kind: 'reviews', source: 'list', list_id: 'reviews-list', translations: titled }], kinds, 'blog')).toBeNull()
    expect(sectionProblem([{ kind: 'reviews', source: 'list', list_id: 'reviews-list', translations: [{ title: '' }] }], kinds, 'home')).toBeNull()
    expect(sectionProblem([{ kind: 'reviews', source: 'list', list_id: 'cards-list', translations: titled }], kinds, 'home'))
      .toBe('Section 1: a "cards" list cannot fill a "reviews" section')
    expect(sectionProblem([{ kind: 'reviews', source: 'posts', translations: titled }], kinds, 'home'))
      .toBe('Section 1: "reviews" cannot show "posts"')
  })

  it('lets only a review carry a rating and a trip line', () => {
    expect(BLOCK_RULES.reviews.item.rating).toBe(true)
    expect(BLOCK_RULES.reviews.item.subtitle).toBe(true)
    expect(BLOCK_RULES.cards.item.rating).toBeFalsy()
  })

  it('keeps a rating of one to five whole stars', () => {
    expect(ratingOf(5)).toBe(5)
    expect(ratingOf('4')).toBe(4)
    expect(ratingOf(0)).toBeNull()
    expect(ratingOf(6)).toBeNull()
    expect(ratingOf(4.5)).toBeNull()
    expect(ratingOf(null)).toBeNull()
  })
})

describe('normaliseAnchor', () => {
  it('keeps a url-safe slug', () => {
    expect(normaliseAnchor('  Горящие Hot deals! ')).toBe('hot-deals')
    expect(normaliseAnchor('   ')).toBeNull()
    expect(normaliseAnchor(null)).toBeNull()
  })
})

describe('feature icons', () => {
  it('lets only the feature list carry a line icon', () => {
    expect(BLOCK_RULES.features.item.icon).toBe(true)
    expect(BLOCK_RULES.cards.item.icon).toBe(false)
    expect(BLOCK_RULES.carousel.item.icon).toBe(false)
  })

  it('accepts only icons from the set', () => {
    expect(isFeatureIcon('trophy')).toBe(true)
    expect(isFeatureIcon('emoji')).toBe(false)
    expect(isFeatureIcon(null)).toBe(false)
  })
})
