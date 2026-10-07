import { describe, expect, it } from 'vitest'
import { pageOf, pageRequest } from './pagination'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
describe('pageRequest', () => {
  it('is off when no page is asked for, so old callers keep the plain list', () => {
    expect(pageRequest(undefined, undefined)).toBeNull()
    expect(pageRequest('', '50')).toBeNull()
  })

  it('keeps sizes to the allowed set and pages to whole numbers from 1', () => {
    expect(pageRequest('3', '50')).toEqual({ page: 3, perPage: 50, skip: 100 })
    expect(pageRequest('0', '7')).toEqual({ page: 1, perPage: 25, skip: 0 })
    expect(pageRequest('abc', '100')).toEqual({ page: 1, perPage: 100, skip: 0 })
    expect(pageRequest('2.9', undefined)).toEqual({ page: 2, perPage: 25, skip: 25 })
  })
})

describe('pageOf', () => {
  it('counts pages and never reports zero', () => {
    const request = pageRequest('1', '25')!

    expect(pageOf([], 0, request, {}).pages).toBe(1)
    expect(pageOf(['a'], 51, request, { all: 51 })).toEqual({ items: ['a'], total: 51, page: 1, per_page: 25, pages: 3, counts: { all: 51 } })
  })
})
