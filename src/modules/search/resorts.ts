/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

const BAY = new Set(['bay', 'bey', 'bei', 'bai'])

export const RESORT_SYNONYMS: Record<string, string> = {
  baku: 'г. Баку',
  hankendi: 'Ханкенди',
  hadaba: 'Хадаба',
  naamabay: 'Наама Бэй',
  nabk: 'Набк',
  nabkbay: 'Набк Бэй',
  sharksbay: 'Шаркс Бэй',
  rasnasrani: 'Рас Назрани',
  sharmelsheyh: 'Шарм-эль-Шейх',
}

export function resortKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[а-яё]/g, letter => CYRILLIC[letter] ?? letter)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(word => word.replace(/kh/g, 'h').replace(/q/g, 'k').replace(/ei/g, 'ey'))
    .map(word => (BAY.has(word) ? 'bay' : word))
    .join('')
}

const cyrillic = (value: string): boolean => /[а-яё]/i.test(value)

const tidy = (value: string): string =>
  value === value.toUpperCase() && !cyrillic(value)
    ? value.toLowerCase().replace(/(^|[\s\-'])(\p{L})/gu, (_, gap: string, letter: string) => gap + letter.toUpperCase())
    : value

export function resortLabel(name: string): string {
  return RESORT_SYNONYMS[resortKey(name)] ?? name
}

export function bestLabel(key: string, variants: Map<string, number>): string {
  const named = RESORT_SYNONYMS[key]

  if (named) return named

  const ranked = [...variants].sort((a, b) => Number(cyrillic(b[0])) - Number(cyrillic(a[0])) || b[1] - a[1])

  return tidy(ranked[0]?.[0] ?? key)
}
