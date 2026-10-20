import { describe, expect, it } from 'vitest'
import { Availability, SupplierState } from '~/modules/search/contracts/search'
import type { SupplierStatus } from '~/modules/search/contracts/search'
import type { IOffer } from '~/modules/search/models/Offer'
import { isCode, isHot, languagesOf, liveTours, MAX_TOURS, newCode, titleOf, tourOf, toursOf } from './marketing.rules'
import { cleanCopy, DEFAULT_VOICE, editedCopy, factsOf, fallbackCopy, systemPrompt, variantsOf } from './ai/copywriter'
import { contactsOf, designOf, pickedContacts } from './marketing.rules'
import { keyboardOf, usernameOf } from './telegram.publisher'
import { DEFAULT_TEMPLATE, DEFAULT_VISUAL, templateOf, templatesOf, templateSystem } from './templates'
import { checkGroups, judge, matchOffer, settle } from './recheck'
import type { IAdTour } from './selection.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const trip = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  offer_id: 'kmp:1',
  hotel_name: 'Royal Tulip Hotel 3*',
  hotel_stars: 3,
  supplier_id: 'kompastour',
  supplier_name: 'Kompas',
  check_in: '2026-11-04',
  nights: 7,
  adults: 2,
  children: 0,
  meal_code: 'BB',
  meal_name: 'Завтраки',
  room_name: 'Standard Room',
  price_amount: 1099,
  price_currency: 'USD',
  route_from: 'tashkent',
  route_to: 'uae',
  route_to_label: 'ОАЭ',
  ...over,
})

const offer = (over: Partial<IOffer> = {}): IOffer => ({
  id: 'kmp:1',
  supplier: { id: 'kompastour', name: 'Kompas' },
  hotelName: 'ROYAL TULIP HOTEL',
  hotelStars: 3,
  hotelSupplierCode: '77',
  hotelSlug: null,
  hotelUrl: null,
  bookingUrl: null,
  district: null,
  checkIn: '2026-11-04',
  nights: 7,
  mealCode: 'BB',
  mealName: 'Завтраки',
  roomName: 'STANDARD ROOM',
  adults: 2,
  children: 0,
  price: { source: { amount: 1099, currency: 'USD' } },
  availability: Availability.Available,
  availabilityNote: null,
  flightNote: null,
  refundable: null,
  programme: null,
  fare: null,
  ...over,
})

const done: SupplierStatus[] = [{ supplier: { id: 'kompastour', name: 'Kompas' }, state: SupplierState.Done, offers: 3 }]

describe('picking tours for a selection', () => {
  it('keeps the tour facts and drops anything unknown or unsafe', () => {
    const tour = tourOf({ ...trip(), secret: 'x', price_amount: '1099.499', kid_ages: [5, 40, 'a'], children: 1 })

    expect(tour).toMatchObject({ hotel_name: 'Royal Tulip Hotel 3*', price_amount: 1099.5, supplier_id: 'kompastour', kid_ages: [5] })
    expect(tour).not.toHaveProperty('secret')
  })

  it('refuses a tour without a hotel, a date or a price', () => {
    expect(tourOf(trip({ hotel_name: '' }))).toBeNull()
    expect(tourOf(trip({ check_in: '4 ноября' }))).toBeNull()
    expect(tourOf(trip({ price_amount: 0 }))).toBeNull()
  })

  it('takes six distinct tours at most', () => {
    const many = Array.from({ length: 9 }, (_, i) => trip({ offer_id: `o${i % 7}` }))

    expect(toursOf(many)).toHaveLength(MAX_TOURS)
    expect(new Set(toursOf(many).map(tour => tour.offer_id)).size).toBe(MAX_TOURS)
  })

  it('names the selection after the destination', () => {
    expect(titleOf(toursOf([trip()]))).toBe('ОАЭ')
  })

  it('calls it hot only when every tour leaves within ten days', () => {
    expect(isHot(toursOf([trip({ check_in: '2026-10-25' })]), '2026-10-20')).toBe(true)
    expect(isHot(toursOf([trip({ check_in: '2026-10-25' }), trip({ offer_id: 'b', check_in: '2026-11-25' })]), '2026-10-20')).toBe(false)
  })

  it('makes short public codes', () => {
    const code = newCode()

    expect(isCode(code)).toBe(true)
    expect(isCode('ABC1234')).toBe(false)
  })

  it('writes both languages unless asked for one', () => {
    expect(languagesOf(undefined)).toEqual(['ru', 'uz'])
    expect(languagesOf(['uz'])).toEqual(['uz'])
  })
})

describe('AI copy', () => {
  const facts = factsOf(toursOf([trip()]), '2026-10-20')
  const fallback = fallbackCopy(facts, 'ru')

  it('takes clean model copy', () => {
    const copy = cleanCopy({ kicker: 'Тёплая осень', headline: 'Дубай', intro: 'Город, который не спит ✨', cta: 'Выбрать отель', hashtags: ['#Dubai', 'оаэ', 'two words'] }, fallback)

    expect(copy).toMatchObject({ kicker: 'Тёплая осень', headline: 'Дубай', ai: true, hashtags: ['dubai', 'оаэ'] })
  })

  it('never lets the model write a number', () => {
    const copy = cleanCopy({ kicker: 'Скидки до 30%', headline: 'Дубай', intro: 'Всего 7 ночей', cta: 'Выбрать' }, fallback)

    expect(copy.kicker).toBe(fallback.kicker)
    expect(copy.intro).toBe(fallback.intro)
    expect(copy.headline).toBe('Дубай')
  })

  it('keeps only the place when the model adds a slogan after a colon', () => {
    expect(cleanCopy({ headline: 'Стамбул: горящие туры' }, fallback).headline).toBe('Стамбул')
  })

  it('falls back entirely on garbage', () => {
    expect(cleanCopy('nope', fallback)).toEqual({ ...fallback, ai: false })
  })

  it('lets staff edit freely within the limits', () => {
    const edited = editedCopy({ intro: 'Скидка 5% до пятницы', hashtags: [] }, fallback)

    expect(edited?.intro).toBe('Скидка 5% до пятницы')
    expect(edited?.hashtags).toEqual([])
    expect(edited?.headline).toBe(fallback.headline)
  })
})

describe('re-checking prices', () => {
  const tour = toursOf([trip()])[0]

  it('searches once per route, date and party', () => {
    const groups = checkGroups([tour, { ...tour, offer_id: 'b', hotel_name: 'Hampton by Hilton' }], '2026-10-20')

    expect(groups).toHaveLength(1)
    expect(groups[0].criteria).toMatchObject({ from: 'tashkent', to: 'uae', dateFrom: '2026-11-04', nightsFrom: 7, nightsTo: 7 })
    expect(groups[0].criteria.filters.hotels).toEqual(['royaltulip', 'hamptonbyhilton'])
    expect(groups[0].criteria.filters.suppliers).toEqual(['kompastour'])
  })

  it('finds the same package however the operator spells it', () => {
    expect(matchOffer(tour, [offer()])).not.toBeNull()
    expect(matchOffer(tour, [offer({ mealCode: 'AI' })])).toBeNull()
    expect(matchOffer(tour, [offer({ supplier: { id: 'other', name: 'Other' } })])).toBeNull()
  })

  it('reports same, changed and gone', () => {
    expect(judge(tour, offer(), done).check_state).toBe('same')

    const dearer = judge(tour, offer({ price: { source: { amount: 1149, currency: 'USD' } } }), done)

    expect(dearer).toMatchObject({ check_state: 'changed', price_amount: 1149, check_was: 1099 })
    expect(judge(tour, null, done).check_state).toBe('gone')
    expect(judge(tour, offer({ availability: Availability.Stopped }), done).check_state).toBe('gone')
  })

  it('does not call a tour gone when the operator failed to answer', () => {
    const failed: SupplierStatus[] = [{ ...done[0], state: SupplierState.Failed }]

    expect(judge(tour, null, failed).check_state).toBe('unknown')
  })

  it('marks departed tours gone without searching', () => {
    expect(settle(tour, '2026-11-05')?.check_state).toBe('gone')
    expect(settle(tour, '2026-10-20')).toBeNull()
    expect(checkGroups([tour], '2026-11-05')).toHaveLength(0)
  })
})

describe('the public view', () => {
  it('hides tours that are gone', () => {
    const tours: IAdTour[] = [{ ...toursOf([trip()])[0], check_state: 'gone' }, { ...toursOf([trip({ offer_id: 'b' })])[0], check_state: 'same' }]

    expect(liveTours(tours).map(tour => tour.offer_id)).toEqual(['b'])
  })
})

describe('brand voice and versions', () => {
  const facts = factsOf(toursOf([trip()]), '2026-10-20')

  it('refuses emoji even when the model sneaks them in', () => {
    const copy = cleanCopy({ kicker: 'Подборка', headline: 'Дубай ✨', intro: 'Тёплый город 🌴', cta: 'Выбрать' }, fallbackCopy(facts, 'ru'))

    expect(copy.headline).toBe('ОАЭ')
    expect(copy.intro).toBe(fallbackCopy(facts, 'ru').intro)
  })

  it('returns four versions in angle order, filling gaps from the brand templates', () => {
    const variants = variantsOf([{ angle: 'timing', kicker: 'Осенью', headline: 'Дубай', intro: 'Спокойно спланируйте поездку.', cta: 'Выбрать' }], facts, 'ru')

    expect(variants.map(variant => variant.angle)).toEqual(['compare', 'escape', 'timing', 'care'])
    expect(variants[2]).toMatchObject({ kicker: 'Осенью', ai: true })
    expect(variants[0]?.ai).toBe(false)
  })

  it('puts the editable voice into the prompt and falls back to the house voice', () => {
    expect(systemPrompt('Пишем строго и коротко.')).toContain('Пишем строго и коротко.')
    expect(systemPrompt('')).toContain(DEFAULT_VOICE)
    expect(systemPrompt('')).toContain('Never use emoji')
  })
})

describe('banner design', () => {
  it('fills defaults and keeps values in range', () => {
    expect(designOf({ dim: 400, rows: 0, backdrop: 'space', price: 'person', caps: false })).toMatchObject({
      dim: 90, rows: 1, backdrop: 'scene', price: 'person', caps: false, stars: true,
    })
  })

  it('keeps earlier choices when a patch changes one thing', () => {
    expect(designOf({ stars: false }, { backdrop: 'type', rows: 3 })).toMatchObject({ backdrop: 'type', rows: 3, stars: false })
    expect(designOf({}, { backdrop: 'sunset' as never }).backdrop).toBe('scene')
  })
})

describe('manager buttons', () => {
  it('reads a Telegram username however it is pasted', () => {
    expect(usernameOf('@aziz_tripme')).toBe('aziz_tripme')
    expect(usernameOf('https://t.me/aziz_tripme')).toBe('aziz_tripme')
    expect(usernameOf('t me')).toBe('')
  })

  it('keeps only named contacts with a valid username', () => {
    const contacts = contactsOf([{ name: 'Азиз', telegram: '@aziz_tripme' }, { name: '', telegram: '@lola_tm' }, { name: 'Лола', telegram: 'no' }])

    expect(contacts).toHaveLength(1)
    expect(contacts[0]).toMatchObject({ name: 'Азиз', telegram: 'aziz_tripme' })
  })

  it('lets a selection use four known managers at most', () => {
    const known = contactsOf(Array.from({ length: 6 }, (_, i) => ({ name: `M${i}`, telegram: `manager_${i}` })))

    expect(pickedContacts([...known.map(contact => contact.id), 'stranger'], known)).toHaveLength(4)
  })

  it('puts the offer link on its own row and managers two per row', () => {
    const rows = keyboardOf([{ text: 'Выбрать тур', url: 'https://tripme.uz/p/x' }, { text: 'Азиз', url: 'a' }, { text: 'Лола', url: 'b' }, { text: 'Тимур', url: 'c' }])

    expect(rows.map(row => row.map(button => button.text))).toEqual([['Выбрать тур'], ['Азиз', 'Лола'], ['Тимур']])
  })
})

describe('AI templates', () => {
  it('keeps only known values and clamps the darkening', () => {
    const template = templateOf({ name: 'Афиша', layout: 'poster', align: 'center', headline: 'xxl', accent: 'neon', dim: 200, cta: 'pill', colour: '#FF0000' })

    expect(template).toMatchObject({ name: 'Афиша', layout: 'poster', align: 'center', headline: 'l', accent: 'none', dim: 90 })
    expect(template).not.toHaveProperty('colour')
  })

  it('refuses emoji names and drops duplicates, four at most', () => {
    const list = templatesOf([
      { name: 'Огонь 🔥', layout: 'split' },
      { name: 'Двойник', layout: 'split' },
      { layout: 'card' }, { layout: 'poster' }, { layout: 'stack', align: 'center' }, { layout: 'stack', list: 'minimal' },
    ])

    expect(list).toHaveLength(4)
    expect(list[0]?.name).toBe(DEFAULT_TEMPLATE.name)
    expect(list.map(item => item.layout)).toEqual(['split', 'card', 'poster', 'stack'])
  })

  it('designs inside the editable visual style', () => {

    expect(templateSystem('Минимализм, много воздуха')).toContain('Минимализм, много воздуха')
    expect(templateSystem('')).toContain(DEFAULT_VISUAL)
  })
})
