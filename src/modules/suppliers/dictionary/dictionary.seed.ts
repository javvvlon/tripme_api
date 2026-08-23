/**
 * Slug ↔ supplier code, seeded from the reference data harvested off the
 * search form.
 *
 * This belongs in Postgres, editable by a human — supplier codes are facts we
 * learn, not constants we own, and when Kompas renumbers a country nobody
 * wants to ship a release. It lives in code today only because the first
 * milestone runs on fixtures with no database behind it.
 *
 * Matching is by the supplier's own label, so adding a country is adding one
 * line here rather than hunting for a numeric id.
 *
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const DEPARTURE_LABELS: Record<string, string[]> = {
  tashkent: ['Ташкент'],
  samarkand: ['Самарканд'],
  bukhara: ['Бухара'],
  urgench: ['Ургенч'],
  fergana: ['Фергана'],
  almaty: ['Алматы'],
  aktau: ['Актау'],
  baku: ['Баку'],
  tbilisi: ['Тбилиси'],
  vienna: ['Вена'],
}

export const COUNTRY_LABELS: Record<string, string[]> = {
  turkey: ['Турция'],
  egypt: ['Египет'],
  uae: ['ОАЭ', 'Объединенные Арабские Эмираты'],
  thailand: ['Таиланд'],
  maldives: ['Мальдивы'],
  georgia: ['Грузия'],
  vietnam: ['Вьетнам'],
  india: ['Индия'],
  indonesia: ['Индонезия'],
  china: ['Китай'],
  azerbaijan: ['Азербайджан'],
  kazakhstan: ['Казахстан'],
}

/** SAMO currency ids, confirmed off the live form. */
export const CURRENCY_CODES: Record<string, string> = {
  EUR: '3',
  USD: '2',
  UZS: '10',
}

export const CURRENCY_BY_CODE: Record<string, 'USD' | 'EUR' | 'UZS'> = {
  '2': 'USD',
  '3': 'EUR',
  '10': 'UZS',
}
