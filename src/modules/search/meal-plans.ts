/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const MEAL_PLANS = ['RO', 'BB', 'HB', 'FB', 'AI', 'UAI', 'PROGRAM'] as const

export type MealPlan = typeof MEAL_PLANS[number]

const RULES: Array<[MealPlan, RegExp]> = [
  ['PROGRAM', /ПО ПРОГРАММЕ|PROGRAM/],
  ['UAI', /\bUAI\b|ULTRA|\bUALL\b/],
  ['AI', /\bAI\b|ALL[\s-]*INCL|\bALL\b|ВСЁ ВКЛЮЧЕНО|ВСЕ ВКЛЮЧЕНО/],
  ['FB', /\bFB\b|FULL[\s-]*BOARD|ПОЛНЫЙ ПАНСИОН/],
  ['HB', /\bHB\b|HALF[\s-]*BOARD|ПОЛУПАНСИОН/],
  ['BB', /\bBB\b|BED\s*(&|AND)\s*BREAKFAST|BREAKFAST|ЗАВТРАК/],
  ['RO', /\bRO\b|ROOM[\s-]*ONLY|\bOB\b|ONLY\s*BED|NO\s*MEAL|\bSC\b|SELF[\s-]*CATERING|\bAO\b|БЕЗ ПИТАНИЯ/],
]

export function mealPlanOf(code: string | null | undefined, name?: string | null): MealPlan | null {
  const text = `${code ?? ''} ${name ?? ''}`.toUpperCase().replace(/\+/g, ' ')

  if (!text.trim()) return null

  return RULES.find(([, pattern]) => pattern.test(text))?.[0] ?? null
}

export const mealKeyOf = (code: string | null | undefined, name?: string | null): string =>
  mealPlanOf(code, name) ?? (code ?? '').trim()
