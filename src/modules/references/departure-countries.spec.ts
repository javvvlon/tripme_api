import { describe, expect, it } from 'vitest'
import { byHomeFirst, isAsianDeparture } from './departure-countries'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
describe('departure cities', () => {
  it('keeps Asian countries and drops Europe and Russia', () => {
    expect(['tashkent', 'almaty', 'bishkek', 'baku', 'tbilisi'].every(isAsianDeparture)).toBe(true)
    expect(['praga', 'minsk', 'novosibirsk', 'frankfurt-na-mayne', 'unknown'].some(isAsianDeparture)).toBe(false)
  })

  it('puts Tashkent first, then Uzbekistan, then the rest by name', () => {
    const cities = [
      { slug: 'almaty', label: 'Алматы' },
      { slug: 'samarkand', label: 'Самарканд' },
      { slug: 'tashkent', label: 'Ташкент' },
      { slug: 'baku', label: 'Баку' },
      { slug: 'bukhara', label: 'Бухара' },
    ]

    expect(cities.sort(byHomeFirst).map(city => city.slug))
      .toEqual(['tashkent', 'bukhara', 'samarkand', 'almaty', 'baku'])
  })
})
