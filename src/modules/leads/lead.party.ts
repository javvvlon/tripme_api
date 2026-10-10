import type { LeadEntity } from './lead.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const MAX_ADULTS = 12

const MAX_CHILDREN = 8

const ADULT_AGE = 18

export const agesOf = (value: unknown): number[] =>
  (Array.isArray(value) ? value : [])
    .map(Number)
    .filter(age => Number.isInteger(age) && age >= 0 && age < ADULT_AGE)
    .slice(0, MAX_CHILDREN)

export const partyOf = (adults: number, ages: number[], children = ages.length): Partial<LeadEntity> => {
  const grown = Math.min(Math.max(0, adults), MAX_ADULTS)
  const kids = Math.min(Math.max(ages.length, children), MAX_CHILDREN)

  return { adults: grown, children: kids, childrenAges: ages, partySize: grown + kids }
}
