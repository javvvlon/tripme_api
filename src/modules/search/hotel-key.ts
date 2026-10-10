/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const NOISE = new Set(['hotel', 'hotels', 'otel', 'отель', 'гостиница', 'the'])

const flatten = (value: string | null | undefined): string =>
  String(value ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()

const wordsOf = (name: string | null | undefined): string[] => flatten(name)
  .replace(/\(.*?\)|\[.*?\]/g, ' ')
  .replace(/\d\s*\*+(\s*sup\b)?|\*+|★+|\b\d\s*(stars?|звезд\S*)/g, ' ')
  .replace(/&/g, ' and ')
  .split(/[^a-zа-яё0-9]+/)
  .filter(word => word && !NOISE.has(word))

export function hotelKey(name: string | null | undefined): string {
  return wordsOf(name).join('')
}

export function hotelLabel(name: string): string {
  const plain = name.replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/\s*\d\s*\*+(\s*sup)?\s*$/i, '').replace(/\s+/g, ' ').trim()

  if (plain !== plain.toUpperCase()) return plain

  return plain.toLowerCase().replace(/(^|[\s\-'(])(\p{L})/gu, (_, gap: string, letter: string) => gap + letter.toUpperCase())
}

export function matchesHotel(name: string, query: string): boolean {
  const wanted = wordsOf(query)

  if (!wanted.length) return false

  const words = wordsOf(name)

  return wanted.every(part => words.some(word => word.startsWith(part))) || hotelKey(name).includes(wanted.join(''))
}
