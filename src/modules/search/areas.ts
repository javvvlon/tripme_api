/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IAreaTown {
  name: string
  region: string
}

const MIN_PREFIX = 4

const MIN_FUZZY = 6

export const areaKey = (value: string): string =>
  value.replace(/^\s*(о\.|остров\s)\s*/iu, '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, '')

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)

  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]!

    row[0] = i

    for (let j = 1; j <= b.length; j++) {
      const kept = row[j]!

      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
      previous = kept
    }
  }

  return row[b.length]!
}

export function sameArea(wanted: string, place: string): boolean {
  const a = areaKey(wanted)
  const b = areaKey(place)

  if (!a || !b) return false
  if (a === b) return true

  const [short, long] = a.length <= b.length ? [a, b] : [b, a]

  if (short.length >= MIN_PREFIX && long.startsWith(short)) return true

  return short.length >= MIN_FUZZY && distance(a, b) <= 1
}

export const areaParts = (areas: string[]): string[] =>
  [...new Set(areas.flatMap(area => area.split(/\s*\+\s*/)).map(area => area.trim()).filter(Boolean))]

export function townsIn<T extends IAreaTown>(towns: T[], areas: string[]): T[] {
  const parts = areaParts(areas)
  const named = towns.filter(town => parts.some(part => sameArea(part, town.name)))

  return named.length ? named : towns.filter(town => parts.some(part => sameArea(part, town.region)))
}

export function resortTowns(towns: IAreaTown[], areas: string[]): string[] {
  const parts = areaParts(areas)
  const asked = (place: string) => parts.some(part => sameArea(part, place))
  const resortOfItsOwn = (town: IAreaTown) => towns.some(other => sameArea(other.region, town.name) && !sameArea(other.region, town.region))

  return [...new Set(towns
    .filter(town => asked(town.name) || (asked(town.region) && !resortOfItsOwn(town)))
    .map(town => town.name))]
}
