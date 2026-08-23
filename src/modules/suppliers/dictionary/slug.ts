/**
 * Turns a supplier's label into a URL slug.
 *
 * Needed because the seed map only covers the destinations we thought to name.
 * Filtering out everything else silently hid inventory: Tashkent offers 27
 * countries and the map knew 12, so a third of the catalogue simply vanished.
 *
 * The slug is derived, not authored, so it must be stable — the same label
 * always yields the same slug, and the label→code pairing is cached alongside
 * it, so nothing depends on guessing the code back from the slug.
 *
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

export function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    // «Занзибар (Танзания)» → the parenthetical is a gloss, not part of the name
    .replace(/\(.*?\)/g, '')
    .split('')
    .map(char => CYRILLIC[char] ?? char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
