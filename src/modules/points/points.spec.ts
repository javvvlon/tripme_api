import { describe, expect, it } from 'vitest'
import { pointsFor, resolveTier } from './points.service'
import { DEFAULT_RATES } from './points.entities'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const tiers = [
  { id: 'g', name: 'Gold', threshold: 10000, discount_percent: 5 },
  { id: 's', name: 'Silver', threshold: 5000, discount_percent: 3 },
  { id: 'p', name: 'Platinum', threshold: 25000, discount_percent: 8 },
]

describe('resolveTier', () => {
  it('has no tier below the first threshold and points at it', () => {
    expect(resolveTier(tiers, 1200)).toEqual({ tier: null, next: tiers[1], to_next: 3800 })
  })

  it('takes the highest threshold reached, whatever the order given', () => {
    expect(resolveTier(tiers, 10000).tier?.name).toBe('Gold')
    expect(resolveTier(tiers, 24999).tier?.name).toBe('Gold')
    expect(resolveTier(tiers, 24999).to_next).toBe(1)
  })

  it('has nothing left to reach at the top', () => {
    expect(resolveTier(tiers, 30000)).toEqual({ tier: tiers[2], next: null, to_next: 0 })
  })

  it('copes with no tiers at all', () => {
    expect(resolveTier([], 500)).toEqual({ tier: null, next: null, to_next: 0 })
  })
})

describe('pointsFor', () => {
  it('turns a price into points by the currency rate', () => {
    expect(pointsFor(1000, 'USD', DEFAULT_RATES)).toBe(10000)
    expect(pointsFor(12500000, 'uzs', DEFAULT_RATES)).toBe(10000)
  })

  it('gives nothing for an unpriced order or an unknown currency', () => {
    expect(pointsFor(null, 'USD', DEFAULT_RATES)).toBe(0)
    expect(pointsFor(1000, 'GBP', DEFAULT_RATES)).toBe(0)
  })
})
