import { describe, expect, it } from 'vitest'
import { normaliseAnchor, sectionProblem } from './content.blocks'

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

describe('normaliseAnchor', () => {
  it('keeps a url-safe slug', () => {
    expect(normaliseAnchor('  Горящие Hot deals! ')).toBe('hot-deals')
    expect(normaliseAnchor('   ')).toBeNull()
    expect(normaliseAnchor(null)).toBeNull()
  })
})
