import { describe, expect, it } from 'vitest'
import { decide, decisionReply, quoteVariants } from './quote.rules'
import type { IQuoteData } from './quote.rules'

const variants = quoteVariants([
  { title: 'Liman Hotel 3*', price: '794 $', trip: { hotel_name: 'Liman Hotel' } },
  { title: 'Rixos 5*', price: '1 900 $', trip: { hotel_name: 'Rixos' } },
])

const quote: IQuoteData = { lead_id: 'l', lead_ref: 'LD-1', locale: 'ru', variants }
const at = new Date('2026-10-12T10:00:00Z')

describe('quoteVariants', () => {
  it('numbers variants and starts them undecided', () => {
    expect(variants.map(variant => [variant.n, variant.decision])).toEqual([[1, null], [2, null]])
  })

  it('refuses a variant without a hotel', () => {
    expect(() => quoteVariants([{ title: 'x', trip: {} }])).toThrow()
  })

  it('refuses more than three variants', () => {
    expect(() => quoteVariants(Array.from({ length: 4 }, () => ({ title: 'x', trip: { hotel_name: 'x' } })))).toThrow()
  })
})

describe('decide', () => {
  it('keeps only one accepted variant', () => {
    const first = decide(quote, 1, 'accepted', at)
    const second = decide(first, 2, 'accepted', at)

    expect(second.variants.map(variant => variant.decision)).toEqual([null, 'accepted'])
  })

  it('declines without touching the others', () => {
    const accepted = decide(quote, 2, 'accepted', at)

    expect(decide(accepted, 1, 'declined', at).variants.map(variant => variant.decision)).toEqual(['declined', 'accepted'])
  })

  it('refuses an unknown variant', () => {
    expect(() => decide(quote, 7, 'accepted', at)).toThrow()
  })
})

describe('decisionReply', () => {
  it('speaks the language of the offer', () => {
    expect(decisionReply('en', variants[0]!, 'accepted')).toBe('✅ Variant 1 works for me: Liman Hotel 3*')
  })
})
