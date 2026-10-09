import { describe, expect, it } from 'vitest'
import { MEAL_PLANS, mealKeyOf, mealPlanOf } from './meal-plans'
import { Offer } from './models/Offer'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
describe('meal plans', () => {
  it('folds every operator spelling into one plan', () => {
    const seen: Array<[string, string | null, string]> = [
      ['BB', null, 'BB'],
      ['Bed & Breakfast', 'Bed And Breakfast', 'BB'],
      ['BB', 'Завтрак', 'BB'],
      ['RO', null, 'RO'],
      ['ROOM ONLY', null, 'RO'],
      ['Room Only', 'Room Only', 'RO'],
      ['OB', 'Без питания', 'RO'],
      ['HB', 'Half Board', 'HB'],
      ['HB+', null, 'HB'],
      ['FB', 'Full board', 'FB'],
      ['AI', 'All Inclusive', 'AI'],
      ['ALL', 'Всё включено', 'AI'],
      ['UAI', 'Ultra All Inclusive', 'UAI'],
      ['ULTRA ALL INCLUSIVE', null, 'UAI'],
      ['По программе', 'Питание по программе тура', 'PROGRAM'],
    ]

    for (const [code, name, plan] of seen) expect(mealPlanOf(code, name), `${code} / ${name}`).toBe(plan)
  })

  it('keeps an unknown meal as its own code instead of guessing', () => {
    expect(mealPlanOf('XYZ', 'Something')).toBeNull()
    expect(mealKeyOf('XYZ', 'Something')).toBe('XYZ')
    expect(mealKeyOf(null)).toBe('')
  })

  it('lists plans from the lightest to the richest', () => {
    expect(MEAL_PLANS.slice(0, 6)).toEqual(['RO', 'BB', 'HB', 'FB', 'AI', 'UAI'])
  })
})

describe('meal plan on an offer', () => {
  it('travels with the offer to the site', () => {
    const offer = new Offer({ mealCode: 'ROOM ONLY', mealName: 'Room Only Room Only' } as never)

    expect(offer.toObject()).toMatchObject({ mealCode: 'ROOM ONLY', mealPlan: 'RO' })
  })

  it('survives a cached offer that already carries the plan', () => {
    const cached = new Offer({ mealCode: 'BB', mealName: 'Bed & Breakfast', mealPlan: 'BB' } as never)

    expect(cached.toObject()).toMatchObject({ mealPlan: 'BB' })
  })
})
