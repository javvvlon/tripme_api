import { describe, expect, it } from 'vitest'
import { agesOf, partyOf } from './lead.party'

describe('agesOf', () => {
  it('keeps whole child ages only', () => {
    expect(agesOf([5, '7', 18, -1, 2.5, 'x', 0])).toEqual([5, 7, 0])
  })

  it('treats anything but a list as no children', () => {
    expect(agesOf(undefined)).toEqual([])
    expect(agesOf('5,7')).toEqual([])
  })
})

describe('partyOf', () => {
  it('counts adults and children into the party size', () => {
    expect(partyOf(2, [4, 9])).toEqual({ adults: 2, children: 2, childrenAges: [4, 9], partySize: 4 })
  })

  it('keeps a child count that came without ages', () => {
    expect(partyOf(2, [], 1)).toEqual({ adults: 2, children: 1, childrenAges: [], partySize: 3 })
  })

  it('caps a party at twelve adults', () => {
    expect(partyOf(40, []).adults).toBe(12)
  })
})
