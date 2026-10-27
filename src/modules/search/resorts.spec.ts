import { describe, expect, it } from 'vitest'
import { bestLabel, resortKey, resortLabel } from './resorts'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
describe('resort names', () => {
  it('gives every spelling of one place the same key', () => {
    expect(resortKey('Шарм-эль-Шейх')).toBe(resortKey('Sharm El Sheikh'))
    expect(resortKey('Шарм-Эль-Шейх')).toBe(resortKey('Шарм-эль-Шейх'))
    expect(resortKey('Наама Бэй')).toBe(resortKey('NAAMA BAY'))
    expect(resortKey('Наама Бей')).toBe(resortKey('Naama Bay'))
    expect(resortKey('Набк')).toBe(resortKey('NABQ'))
    expect(resortKey('Хадаба')).toBe(resortKey('Hadaba'))
    expect(resortKey('KHANKENDI')).toBe(resortKey('Ханкенди'))
    expect(resortKey('Дахаб')).not.toBe(resortKey('Хадаба'))
  })

  it('keeps the key stable when applied twice', () => {
    expect(resortKey(resortKey('Sharm El Sheikh'))).toBe(resortKey('Sharm El Sheikh'))
  })

  it('labels a resort from the dictionary, else its Russian spelling, else a tidy Latin one', () => {
    expect(resortLabel('Baku')).toBe('г. Баку')
    expect(resortLabel('Султанахмет')).toBe('Султанахмет')
    expect(bestLabel('kemer', new Map([['KEMER', 9], ['Кемер', 2]]))).toBe('Кемер')
    expect(bestLabel('sidebay', new Map([['SIDE BAY', 3]]))).toBe('Side Bay')
  })
})
