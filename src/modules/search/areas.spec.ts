import { describe, expect, it } from 'vitest'
import { areaParts, resortTowns, sameArea, townsIn } from './areas'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const towns = [
  { name: 'Наама Бэй', region: 'Шарм-эль-Шейх' },
  { name: 'Шарм-эль-Шейх', region: 'Шарм-эль-Шейх' },
  { name: 'Дахаб', region: 'Дахаб' },
  { name: 'NAAMA BAY', region: 'Шарм Эль Шейх' },
  { name: 'NABQ', region: 'Шарм Эль Шейх' },
  { name: 'Санья', region: 'о. Хайнань' },
  { name: 'Хайкоу', region: 'о. Хайнань' },
  { name: 'Санья бэй', region: 'Популярные регионы' },
  { name: 'Кемер', region: 'Кемер' },
  { name: 'Бельдиби', region: 'Кемер' },
  { name: 'Анталия', region: 'Анталия' },
  { name: 'Дахаб', region: 'Шарм-эль-Шейх' },
]

describe('resort areas', () => {
  it('treats spellings of one place as the same', () => {
    expect(sameArea('Шарм-эль-Шейх', 'Шарм Эль Шейх')).toBe(true)
    expect(sameArea('Хайнань', 'о. Хайнань')).toBe(true)
    expect(sameArea('Анталья', 'Анталия')).toBe(true)
    expect(sameArea('Набк', 'Набк Бэй')).toBe(true)
    expect(sameArea('Дахаб', 'Шарм-эль-Шейх')).toBe(false)
    expect(sameArea('Сиде', 'Сидней')).toBe(false)
  })

  it('expands a named resort into every town operators list in it', () => {
    expect(resortTowns(towns, ['Шарм-эль-Шейх'])).toEqual(['Наама Бэй', 'Шарм-эль-Шейх', 'NAAMA BAY', 'NABQ'])
    expect(resortTowns(towns, ['Кемер'])).toEqual(['Кемер', 'Бельдиби'])
  })

  it('leaves out a town another operator sells as a resort of its own', () => {
    expect(resortTowns(towns, ['Шарм-эль-Шейх'])).not.toContain('Дахаб')
    expect(resortTowns(towns, ['Дахаб'])).toEqual(['Дахаб'])
  })

  it('finds towns that sit in a generic group by their own names', () => {
    expect(resortTowns(towns, ['Хайнань', 'Санья'])).toEqual(['Санья', 'Хайкоу', 'Санья бэй'])
  })

  it('splits a combo into its places', () => {
    expect(areaParts(['Лангкави + Куала-Лумпур', 'Лангкави'])).toEqual(['Лангкави', 'Куала-Лумпур'])
    expect(resortTowns(towns, ['Дахаб + Кемер'])).toEqual(['Дахаб', 'Кемер', 'Бельдиби'])
  })

  it('matches an operator by town names first and falls back to its resort groups', () => {
    const operator = [{ name: 'Дахаб', region: 'Шарм-эль-Шейх' }, { name: 'Наама Бей', region: 'Шарм-эль-Шейх' }]

    expect(townsIn(operator, ['Шарм-эль-Шейх', 'Наама Бей']).map(town => town.name)).toEqual(['Наама Бей'])
    expect(townsIn(operator, ['Шарм-эль-Шейх']).map(town => town.name)).toEqual(['Дахаб', 'Наама Бей'])
  })
})
