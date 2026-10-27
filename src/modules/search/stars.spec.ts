import { describe, expect, it } from 'vitest'
import { Offer } from './models/Offer'
import { withKnownStars } from './stars'
import { kindOf, starsOf } from '~/modules/suppliers/samo/samo.catalog'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const offer = (hotelName: string, hotelStars: number | null) => new Offer({ hotelName, hotelStars } as never)

describe('hotel stars', () => {
  it('reads every category spelling operators use', () => {
    expect(starsOf('3*')).toBe(3)
    expect(starsOf('4*+')).toBe(4)
    expect(starsOf('5* DELUXE')).toBe(5)
    expect(starsOf('*****')).toBe(5)
    expect(starsOf('***+')).toBe(3)
    expect(starsOf('HV-1')).toBeNull()
    expect(starsOf('Boutique')).toBeNull()
    expect(starsOf(null)).toBeNull()
  })

  it('marks boutique and apartment hotels instead of inventing stars', () => {
    expect(kindOf('Boutique')).toBe('boutique')
    expect(kindOf('APARTMENT')).toBe('apart')
    expect(kindOf('4*')).toBeNull()
  })

  it('borrows stars another operator gives the same hotel', () => {
    const known = new Map<string, number>()
    const first = withKnownStars([offer('Rixos Premium Seagate 5*', 5)], known)
    const later = withKnownStars([offer('RIXOS PREMIUM SEAGATE', null), offer('Unknown Inn', null)], known)

    expect(first[0]!.get('hotelStars')).toBe(5)
    expect(later.map(item => item.get('hotelStars'))).toEqual([5, null])
  })
})
