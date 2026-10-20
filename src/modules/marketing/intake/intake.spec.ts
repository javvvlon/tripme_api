import { describe, expect, it } from 'vitest'
import { Availability } from '~/modules/search/contracts/search'
import type { IOffer } from '~/modules/search/models/Offer'
import { toursOf } from '../marketing.rules'
import { flagCountries, isOwnOffer, labelMatch, ownTours, pickOffer, postFactsOf, postGap, searchDates, tourFromOffer, tourFromPost } from './post'
import type { IPostFacts } from './post'
import { linkCode, originOf, pictureOf, reportText, sameSecret, userOfCode } from './bot'
import { embeddedPostOf, isPrivateLink, postLinkOf } from './link'
import { looksLikeOffer } from './assistant'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const countries = [
  { slug: 'uae', label: 'ОАЭ' },
  { slug: 'srilanka', label: 'Шри-Ланка' },
  { slug: 'turkey', label: 'Турция' },
].map(item => ({ ...item, code: item.slug }))

const today = '2026-10-20'

const facts = (changes: Partial<IPostFacts> = {}): IPostFacts => ({
  country: 'Шри-Ланка', from: '', dates: ['2026-11-12'], nights: 7, basis: 'person', operator: 'Kompas Tour', airline: 'Centrum Air',
  hotels: [{ name: 'Cinnamon Bey', stars: 5, district: 'Беруwala', meal: 'BB', price: 1200, currency: 'USD' }],
  own: false, legs: [], price: null, currency: '', includes: [],
  ...changes,
})

const offer = (changes: Partial<IOffer> & { mealPlan?: string | null } = {}): IOffer & { mealPlan?: string | null } => ({
  id: 'o1',
  supplier: { id: 'kompas', name: 'Kompas Tour' } as IOffer['supplier'],
  hotelName: 'Cinnamon Bey 5*',
  hotelStars: 5,
  hotelSupplierCode: 'h1',
  hotelSlug: null,
  hotelUrl: null,
  bookingUrl: null,
  district: 'Beruwala',
  checkIn: '2026-11-12',
  nights: 7,
  mealCode: 'BB',
  mealName: 'Завтраки',
  roomName: 'Superior',
  adults: 2,
  children: 0,
  price: { source: { amount: 2400, currency: 'USD' }, uzs: { amount: 30_000_000, basis: 'operator', rate: 12_500 } } as unknown as IOffer['price'],
  availability: Availability.Available,
  availabilityNote: null,
  flightNote: null,
  refundable: null,
  programme: null,
  fare: null,
  mealPlan: 'BB',
  ...changes,
})

describe('operator post facts', () => {
  it('keeps only stated, valid facts', () => {
    const read = postFactsOf({
      country: 'Шри Ланка',
      dates: ['2026-11-12', '2026-10-01', 'soon', '2026-11-12'],
      nights: '7',
      basis: 'person',
      operator: 'Kompas Tour',
      hotels: [
        { name: 'Cinnamon Bey 5*', stars: 5, meal: 'bb', price: '1 200', currency: 'usd' },
        { name: 'cinnamon bey', stars: 5, price: 1300 },
        { name: 'Sunny 🌴', price: 900 },
        { name: 'Ocean View', stars: 9, meal: 'lunch', price: -4, currency: 'RUB' },
      ],
    }, { countries, today })

    expect(read.country).toBe('Шри-Ланка')
    expect(read.dates).toEqual(['2026-11-12'])
    expect(read.nights).toBe(7)
    expect(read.hotels).toEqual([
      { name: 'Cinnamon Bey', stars: 5, district: '', meal: 'BB', price: 1200, currency: 'USD' },
      { name: 'Ocean View', stars: null, district: '', meal: '', price: null, currency: '' },
    ])
  })

  it('never invents a country, dates or nights', () => {
    const read = postFactsOf({ country: 'Атлантида', hotels: [] }, { countries, today })

    expect(read).toMatchObject({ country: '', dates: [], nights: null, basis: '', operator: '' })
  })

  it('matches country labels loosely', () => {
    expect(labelMatch('оаэ', countries)?.slug).toBe('uae')
    expect(labelMatch('Шри Ланка', countries)?.slug).toBe('srilanka')
    expect(labelMatch('', countries)).toBeNull()
  })

  it('searches the stated dates, or the coming week', () => {
    expect(searchDates(facts({ dates: ['2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22'] }), today)).toHaveLength(3)
    expect(searchDates(facts({ dates: [] }), today)).toEqual([{ dateFrom: '2026-10-21', dateTo: '2026-10-27' }])
  })
})

describe('operator post tours', () => {
  it('needs the stated meal, then prefers the stated operator, then the price', () => {
    const offers = [
      offer({ id: 'ai', mealPlan: 'AI', price: { source: { amount: 1000, currency: 'USD' } } as IOffer['price'] }),
      offer({ id: 'other', supplier: { id: 'x', name: 'Anex' } as IOffer['supplier'] }),
      offer({ id: 'kompas' }),
      offer({ id: 'stopped', availability: Availability.Stopped }),
    ]
    const hotel = facts().hotels[0]!

    expect(pickOffer('cinnamonbey', hotel, 'Kompas Tour', offers, item => item.price.source.amount)?.id).toBe('kompas')
    expect(pickOffer('elsewhere', hotel, '', offers, item => item.price.source.amount)).toBeNull()
    expect(pickOffer('cinnamonbey', { ...hotel, meal: 'HB' }, '', offers, item => item.price.source.amount)).toBeNull()
    expect(pickOffer('cinnamonbey', { ...hotel, meal: '' }, '', offers, item => item.price.source.amount)?.id).toBe('ai')
  })

  it('copies a live offer with its route', () => {
    const tour = tourFromOffer(offer(), { from: 'tashkent', to: 'srilanka', toLabel: 'Шри-Ланка' })

    expect(tour).toMatchObject({ offer_id: 'o1', supplier_id: 'kompas', price_amount: 2400, price_uzs: 30_000_000, route_to: 'srilanka', source: 'search', meal_plan: 'BB' })
  })

  it('keeps a post price for two people and marks it', () => {
    const hotel = facts().hotels[0]!
    const tour = tourFromPost(hotel, facts(), { from: 'tashkent', to: 'srilanka', toLabel: 'Шри-Ланка' })

    expect(tour).toMatchObject({ price_amount: 2400, adults: 2, source: 'post', post_basis: 'person', check_in: '2026-11-12', supplier_name: 'Kompas Tour' })
    expect(tour?.offer_id).toBe(tourFromPost(hotel, facts(), null)?.offer_id)
    expect(tourFromPost(hotel, facts({ basis: 'total' }), null)?.price_amount).toBe(1200)
  })

  it('skips a post hotel when a fact is missing', () => {
    const hotel = facts().hotels[0]!

    expect(postGap({ ...hotel, price: null }, facts())).toBe('no_price')
    expect(postGap(hotel, facts({ dates: [] }))).toBe('no_date')
    expect(postGap(hotel, facts({ nights: null }))).toBe('no_nights')
    expect(tourFromPost(hotel, facts({ nights: null }), null)).toBeNull()
  })

  it('survives the selection snapshot rules', () => {
    const [tour] = toursOf([tourFromPost(facts().hotels[0]!, facts(), null)])

    expect(tour).toMatchObject({ source: 'post', post_basis: 'person' })
  })
})

describe('telegram intake bot', () => {
  const secret = 'webhook-secret'
  const user = '0b8e7a52-61c4-4d6c-9f0e-3c1d2a4b5e6f'

  it('links a staff account with a short signed code', () => {
    const code = linkCode(user, secret, 1_000_000)

    expect(code.length).toBeLessThanOrEqual(64)
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(userOfCode(code, secret, 1_000_000)).toBe(user)
    expect(userOfCode(code, 'other', 1_000_000)).toBeNull()
    expect(userOfCode(code, secret, 1_000_000 + 16 * 60_000)).toBeNull()
    expect(userOfCode(`${code.slice(0, -1)}x`, secret, 1_000_000)).toBeNull()
  })

  it('checks the webhook secret', () => {
    expect(sameSecret(secret, secret)).toBe(true)
    expect(sameSecret('webhook-secreT', secret)).toBe(false)
    expect(sameSecret(undefined, secret)).toBe(false)
    expect(sameSecret('', '')).toBe(false)
  })

  it('reads where a post was forwarded from and its largest picture', () => {
    const message = {
      message_id: 1,
      chat: { id: 1, type: 'private' },
      forward_origin: { type: 'channel', chat: { title: 'Kompas Tour', username: 'kompastour' } },
      photo: [{ file_id: 'small', width: 90, height: 90 }, { file_id: 'big', width: 1280, height: 1280, file_size: 200_000 }],
    }

    expect(originOf(message)).toBe('Kompas Tour @kompastour')
    expect(pictureOf(message, 8_000_000)).toBe('big')
    expect(pictureOf({ ...message, photo: [{ file_id: 'huge', width: 9, height: 9, file_size: 9_000_000 }] }, 8_000_000)).toBeNull()
  })

  it('explains the result in plain words', () => {
    const ready = reportText('Шри-Ланка', { country: 'Шри-Ланка', operator: '', found: 2, kept: 1, skipped: [{ hotel: 'Ocean View', reason: 'no_price' }] }, 4)

    expect(ready).toContain('Подборка «Шри-Ланка» готова.')
    expect(ready).toContain('— Ocean View: нет цены')
    expect(reportText('', { country: '', operator: '', found: 0, kept: 0, skipped: [] }, 0)).toContain('Не понял, о какой стране пост.')
  })
})

describe('operator post links', () => {
  it('reads public post links and refuses private ones', () => {
    expect(postLinkOf(' https://t.me/kompastour/1234?single ')).toEqual({ channel: 'kompastour', id: 1234, url: 'https://t.me/kompastour/1234' })
    expect(postLinkOf('t.me/s/tripmeuz/387')?.url).toBe('https://t.me/tripmeuz/387')
    expect(postLinkOf('see https://t.me/kompastour/1234')).toBeNull()
    expect(isPrivateLink('https://t.me/c/1234567/89')).toBe(true)
  })

  it('reads text, channel and photo from a post embed', () => {
    const html = '<a class="tgme_widget_message_owner_name"><span>Kompas Tour</span></a>'
      + '<a class="tgme_widget_message_photo_wrap" style="width:800px;background-image:url(\'https://cdn4.telesco.pe/file/abc.jpg\')"></a>'
      + '<div class="tgme_widget_message_text"><b>ТУРЦИЯ</b><br/>Rixos 5* &mdash; от 1150$<br/><br/><br/>Kompas</div>'

    expect(embeddedPostOf(html)).toEqual({ text: 'ТУРЦИЯ\nRixos 5* — от 1150$\n\nKompas', origin: 'Kompas Tour', imageUrl: 'https://cdn4.telesco.pe/file/abc.jpg' })
    expect(embeddedPostOf('<div>nothing</div>')).toEqual({ text: '', origin: '', imageUrl: '' })
  })

  it('tells an operator offer from a question', () => {
    expect(looksLikeOffer('Rixos Downtown 5* — BB — от 1150$, вылет 14 ноября', false)).toBe(true)
    expect(looksLikeOffer('https://t.me/kompastour/1234', false)).toBe(true)
    expect(looksLikeOffer('', true)).toBe(true)
    expect(looksLikeOffer('Как лучше рекламировать горящие туры в Telegram?', false)).toBe(false)
    expect(looksLikeOffer('Бюджет 1500$ на рекламу — куда потратить?', false)).toBe(false)
  })
})

describe('own offers', () => {
  it('reads countries from flag emoji', () => {
    const list = [...countries, { slug: 'vietnam', label: 'Вьетнам', code: 'vietnam' }, { slug: 'singapore', label: 'Сингапур', code: 'singapore' }]

    expect(flagCountries('🇻🇳 Fukuok — tropik orolga 570$ dan!', list).map(item => item.slug)).toEqual(['vietnam'])
    expect(flagCountries('🇸🇬 🇮🇩 🇻🇳 3 davlat', list).map(item => item.slug)).toEqual(['singapore', 'vietnam'])
  })

  it('turns star tiers into our own lines without operators', () => {
    const tiers = facts({
      country: 'Вьетнам', dates: ['2026-10-30'], nights: 7, operator: '',
      hotels: [3, 4, 5].map((stars, i) => ({ name: '', stars, district: '', meal: '' as const, price: [570, 675, 990][i]!, currency: 'USD' as const })),
      includes: ['flight', 'hotel'],
    })

    expect(isOwnOffer(tiers)).toBe(true)

    const { tours, skipped } = ownTours(tiers, { from: 'tashkent', to: 'vietnam', toLabel: 'Вьетнам' }, ['vietnam'])

    expect(skipped).toEqual([])
    expect(tours.map(tour => [tour.hotel_name, tour.tier, tour.price_amount, tour.source])).toEqual([['3*', true, 1140, 'own'], ['4*', true, 1350, 'own'], ['5*', true, 1980, 'own']])
    expect(toursOf(tours)[0]).toMatchObject({ tier: true, hotel_stars: 3, countries: ['vietnam'], source: 'own' })
  })

  it('makes one line for a route through several places', () => {
    const route = facts({
      own: true, country: 'Сингапур', dates: ['2027-01-11'], nights: null, hotels: [], price: 1850, currency: 'USD',
      legs: [{ place: 'Сингапур', country: 'Сингапур', nights: 2, hotel: 'Mercure Icon' }, { place: 'Бали', country: '', nights: 4, hotel: 'Ayodya Resort' }, { place: 'Куала-Лумпур', country: '', nights: 2, hotel: 'The Face Style' }],
    })
    const { tours } = ownTours(route, null, ['singapore', 'indonesia', 'malaysia'])

    expect(tours).toHaveLength(1)
    expect(tours[0]).toMatchObject({ hotel_name: 'Сингапур · Бали · Куала-Лумпур', nights: 8, price_amount: 3700, route_to: 'singapore' })
    expect(toursOf(tours)[0]?.legs).toEqual([{ place: 'Сингапур', nights: 2, hotel: 'Mercure Icon' }, { place: 'Бали', nights: 4, hotel: 'Ayodya Resort' }, { place: 'Куала-Лумпур', nights: 2, hotel: 'The Face Style' }])
  })
})
