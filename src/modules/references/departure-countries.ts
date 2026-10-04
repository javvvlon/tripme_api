/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const HOME_DEPARTURE = 'tashkent'

const COUNTRY_OF: Record<string, string> = {
  tashkent: 'UZ', samarkand: 'UZ', bukhara: 'UZ', urgench: 'UZ', fergana: 'UZ',
  namangan: 'UZ', andijan: 'UZ', navoi: 'UZ', karshi: 'UZ', termez: 'UZ', nukus: 'UZ',
  almaty: 'KZ', astana: 'KZ', aktau: 'KZ', aktobe: 'KZ', atyrau: 'KZ', karaganda: 'KZ',
  kokshetau: 'KZ', kostanay: 'KZ', kyzylorda: 'KZ', petropavlovsk: 'KZ', semey: 'KZ',
  turkestan: 'KZ', uralsk: 'KZ', ustkamenogorsk: 'KZ', shymkent: 'KZ',
  bishkek: 'KG', osh: 'KG',
  dushanbe: 'TJ', khujand: 'TJ',
  ashgabat: 'TM',
  baku: 'AZ', gyandzha: 'AZ',
  tbilisi: 'GE', batumi: 'GE', kutaisi: 'GE',
  yerevan: 'AM',
  ekaterinburg: 'RU', krasnoyarsk: 'RU', novosibirsk: 'RU', tyumen: 'RU',
  brest: 'BY', minsk: 'BY', budapesht: 'HU', buharest: 'RO', varshava: 'PL', katovitse: 'PL',
  krakov: 'PL', poznan: 'PL', vienna: 'AT', kishinev: 'MD', praga: 'CZ', 'frankfurt-na-mayne': 'DE',
}

const ASIAN = new Set(['UZ', 'KZ', 'KG', 'TJ', 'TM', 'AZ', 'GE', 'AM'])

export const isAsianDeparture = (slug: string): boolean => ASIAN.has(COUNTRY_OF[slug] ?? '')

const rank = (slug: string): number => {
  if (slug === HOME_DEPARTURE) return 0

  return COUNTRY_OF[slug] === COUNTRY_OF[HOME_DEPARTURE] ? 1 : 2
}

export const byHomeFirst = <T extends { slug: string, label: string }>(a: T, b: T): number =>
  rank(a.slug) - rank(b.slug) || a.label.localeCompare(b.label, 'ru')
