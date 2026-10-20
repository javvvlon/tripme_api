import { TRUTH_RULES } from '~/shared/ai/truth'
import { destinationOf, isHot, resortsOf } from '../marketing.rules'
import { AD_ANGLES } from '../selection.entity'
import type { AdAngle, AdLanguage, IAdCopy, IAdTour } from '../selection.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const COPY_LIMITS = { kicker: 24, headline: 30, intro: 240, cta: 32, hashtags: 5, hashtag: 30 } as const

export const MAX_VOICE = 4000

export const DEFAULT_VOICE = [
  'Голос TripMe — спокойный эксперт по турам из Узбекистана. Мы не продаём мечту любой ценой: мы честно сравниваем цены всех туроператоров и помогаем выбрать лучший вариант.',
  '',
  'Как мы пишем:',
  '— Обращаемся на «вы», тепло и уважительно, без панибратства.',
  '— Коротко и по делу: одна мысль — одно предложение.',
  '— Факты важнее эмоций: направление, курорт, питание, что входит в пакет — перелёт, отель и трансфер.',
  '— Главная выгода TripMe: «Один поиск — все операторы». Мы уже сравнили предложения всех туроператоров.',
  '— За каждой заявкой — живой менеджер TripMe: проверит места у туроператора и забронирует.',
  '— Премиально, но без пафоса и превосходных степеней.',
  '',
  'Чего мы не делаем:',
  '— Никаких эмодзи, восклицательных знаков подряд и текста капслоком.',
  '— Не давим срочностью и не выдумываем ограничения вроде «осталось два места» или «только сегодня».',
  '— Не обещаем того, чего нет в данных: пляжи, бассейны, виды из окна, скидки.',
  '— Без клише турагентств: «райский отдых», «незабываемые впечатления», «путёвки по супер цене».',
  '',
  'Узбекский — только латиница, обращение на «siz», тот же спокойный экспертный тон.',
  '',
  'Как выглядят наши посты в Telegram-канале @tripmeuz (структуру и цифры добавляет система, ты пишешь только слова):',
  '— Заголовок капсом: направление и суть подборки, например «ШРИ-ЛАНКА: ПОДБОРКА ПРЕМИАЛЬНЫХ ОТЕЛЕЙ».',
  '— Вторая строка — вылет из Ташкента, дата и ночи.',
  '— Затем список отелей с курортом, питанием и ценой в сумах за человека.',
  '— В конце — что входит в стоимость тура и контакты для бронирования.',
  '— Вступление к подборке — одно-два спокойных предложения, без восторгов и без эмодзи.',
].join('\n')

export const DEFAULT_FOOTER: Record<AdLanguage, string> = {
  ru: [
    'В стоимость тура включено: авиаперелёт, проживание, питание, трансфер, страховка.',
    'Бронирование: @tripmeuz • tripme.uz',
    'Оплата — в сумах по курсу туроператора на день оплаты.',
  ].join('\n'),
  uz: [
    'Tur narxiga kiradi: aviaparvoz, yashash, ovqatlanish, transfer, sug‘urta.',
    'Bron qilish: @tripmeuz • tripme.uz',
    'To‘lov so‘mda, to‘lov kunidagi turoperator kursi bo‘yicha.',
  ].join('\n'),
}

const ANGLE_BRIEFS: Record<AdAngle, string> = {
  compare: 'the comparison: one search, every operator, TripMe already compared the prices',
  escape: 'the trip itself: the destination and the kind of rest it offers, strictly from the facts',
  timing: 'the dates: near departures when "hot" is true, otherwise calm planning ahead',
  care: 'the service: a TripMe manager checks availability, books and stays in touch',
}

export const COPY_RULES = [
  'You write advertising copy for TripMe (tripme.uz), a tour service in Uzbekistan that compares package-tour prices across every tour operator and books them through a human manager.',
  'You get facts about a selection of package tours as JSON and return JSON only.',
  'Hard rules that override everything else:',
  '- Never write any digit, price, date, number of nights or number of stars: the system adds every number itself.',
  '- Emoji follow the TripMe voice: use them only when the voice asks for them, and only in "intro". Never put emoji in "kicker", "headline", "cta" or hashtags, because those are drawn on banners.',
  '- Use only the facts given. Never invent hotel features, flights, discounts or availability.',
  `- "kicker": a tiny label above the headline, at most ${COPY_LIMITS.kicker} characters.`,
  `- "headline": only the place name — the destination or one resort, one to three words, at most ${COPY_LIMITS.headline} characters, no colon, no slogan, no final punctuation.`,
  '- When "hot" is true the system already shows a «Горящий тур» badge: never repeat that idea in the headline.',
  '- When "own" is true this is TripMe\'s own package with its own prices: never claim that TripMe compared operators or searched every operator. The "compare" angle then talks about clear value for the price and what the package includes.',
  `- "intro": one or two sentences for a Telegram post, at most ${COPY_LIMITS.intro} characters.`,
  `- "cta": a button label, at most ${COPY_LIMITS.cta} characters.`,
  `- "hashtags": ${COPY_LIMITS.hashtags} or fewer single lowercase words without "#" and without spaces.`,
  TRUTH_RULES,
  'Write one variant per angle, in this order, each clearly different from the others:',
  ...AD_ANGLES.map((angle, index) => `${index + 1}. "${angle}" — ${ANGLE_BRIEFS[angle]}.`),
].join('\n')

export const systemPrompt = (voice: string): string =>
  `${COPY_RULES}\n\nTripMe brand voice — follow it exactly:\n${voice.trim() || DEFAULT_VOICE}`

const LANGUAGE_NAMES: Record<AdLanguage, string> = {
  ru: 'Russian',
  uz: 'Uzbek in Latin script, addressing the reader as «siz»',
}

export interface ICopyFacts {
  destination: string
  resorts: string[]
  departure: string
  hot: boolean
  party: { adults: number, children: number }
  hotels: Array<{ name: string, stars: number | null, meal: string, resort: string }>
  own: boolean
}

export function factsOf(tours: IAdTour[], today: string): ICopyFacts {
  return {
    destination: destinationOf(tours),
    resorts: resortsOf(tours),
    departure: String(tours[0]?.route_from ?? ''),
    hot: isHot(tours, today),
    party: { adults: tours[0]?.adults ?? 2, children: tours[0]?.children ?? 0 },
    hotels: tours.map(tour => ({
      name: tour.hotel_name,
      stars: Number(tour.hotel_stars) || null,
      meal: String(tour.meal_name ?? tour.meal_code ?? ''),
      resort: String(tour.district ?? ''),
    })),
    own: tours.length > 0 && tours.every(tour => tour.source === 'own'),
  }
}

export function copyPrompt(facts: ICopyFacts, languages: AdLanguage[]): string {
  const variant = { angle: '', kicker: '', headline: '', intro: '', cta: '', hashtags: [] }
  const shape = Object.fromEntries(languages.map(language => [language, AD_ANGLES.map(angle => ({ ...variant, angle }))]))

  return [
    `Write the variants in: ${languages.map(language => `"${language}" = ${LANGUAGE_NAMES[language]}`).join(', ')}.`,
    'Variants with the same angle in different languages say the same thing.',
    `Return exactly this JSON shape: ${JSON.stringify(shape)}`,
    `Facts: ${JSON.stringify(facts)}`,
  ].join('\n')
}

type Fallback = (facts: ICopyFacts) => Omit<IAdCopy, 'ai' | 'angle' | 'headline' | 'hashtags'>

const FALLBACK: Record<AdLanguage, Record<AdAngle, Fallback>> = {
  ru: {
    compare: facts => (facts.own
      ? { kicker: 'Предложение TripMe', intro: 'Мы собрали тур с понятной ценой и всем необходимым в пакете. Менеджер TripMe ответит на вопросы и забронирует.', cta: 'Выбрать тур' }
      : {
          kicker: 'Подборка TripMe',
          intro: 'Мы сравнили цены всех туроператоров и собрали лучшие варианты в одной подборке. Менеджер TripMe проверит места и забронирует.',
          cta: 'Выбрать тур',
        }),
    escape: () => ({
      kicker: 'Время отдыха',
      intro: 'Перелёт, отель и трансфер — в одной цене. Выберите отель, остальное TripMe возьмёт на себя.',
      cta: 'Смотреть отели',
    }),
    timing: facts => facts.hot
      ? { kicker: 'Ближайшие вылеты', intro: 'Вылеты уже в ближайшие дни. Проверим места у туроператора и быстро подтвердим бронь.', cta: 'Забронировать' }
      : { kicker: 'Планируйте заранее', intro: 'Даты, отели и цены всех туроператоров — в одной подборке. Забронируйте заранее и спокойно готовьтесь к поездке.', cta: 'Забронировать' },
    care: () => ({
      kicker: 'С заботой TripMe',
      intro: 'Менеджер TripMe на связи на каждом шаге: поможет выбрать отель, проверит места и оформит бронь.',
      cta: 'Написать менеджеру',
    }),
  },
  uz: {
    compare: facts => (facts.own
      ? { kicker: 'TripMe taklifi', intro: 'Tushunarli narx va kerakli hamma narsa paketga kiritilgan turni tayyorladik. TripMe menejeri savollarga javob berib, bron qiladi.', cta: 'Turni tanlash' }
      : {
          kicker: 'TripMe to‘plami',
          intro: 'Barcha turoperatorlar narxlarini solishtirib, eng yaxshi variantlarni bitta to‘plamga jamladik. TripMe menejeri joylarni tekshirib, bron qiladi.',
          cta: 'Turni tanlash',
        }),
    escape: () => ({
      kicker: 'Dam olish vaqti',
      intro: 'Parvoz, mehmonxona va transfer — bitta narxda. Mehmonxonani tanlang, qolganini TripMe o‘z zimmasiga oladi.',
      cta: 'Mehmonxonalarni ko‘rish',
    }),
    timing: facts => facts.hot
      ? { kicker: 'Yaqin parvozlar', intro: 'Parvozlar yaqin kunlarda. Turoperatorda joylarni tekshirib, bronni tezda tasdiqlaymiz.', cta: 'Bron qilish' }
      : { kicker: 'Oldindan rejalang', intro: 'Sanalar, mehmonxonalar va barcha turoperatorlar narxlari — bitta to‘plamda. Oldindan bron qiling va safarga xotirjam tayyorlaning.', cta: 'Bron qilish' },
    care: () => ({
      kicker: 'TripMe g‘amxo‘rligi',
      intro: 'TripMe menejeri har bir bosqichda aloqada: mehmonxona tanlashda yordam beradi, joylarni tekshiradi va bron qiladi.',
      cta: 'Menejerga yozish',
    }),
  },
}

const FALLBACK_TAGS: Record<AdLanguage, string[]> = {
  ru: ['tripme', 'туры', 'отдых'],
  uz: ['tripme', 'sayohat', 'dam_olish'],
}

export const fallbackCopy = (facts: ICopyFacts, language: AdLanguage, angle: AdAngle = 'compare'): IAdCopy => ({
  ...FALLBACK[language][angle](facts),
  headline: facts.destination,
  hashtags: FALLBACK_TAGS[language],
  ai: false,
  angle,
})

const HAS_DIGIT = /\p{Nd}/u

const HAS_EMOJI = /\p{Extended_Pictographic}/u

const field = (value: unknown, max: number, emoji = false): string | null => {
  if (typeof value !== 'string') return null

  const text = value.replace(/\s+/g, ' ').trim().replace(/^["«]|["»]$/g, '').replace(/!{2,}/g, '!')

  if (!text || HAS_DIGIT.test(text) || (!emoji && HAS_EMOJI.test(text)) || text.length > max) return null

  return text
}

const hashtagsOf = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null

  const tags = value
    .map(tag => (typeof tag === 'string' ? tag.trim().replace(/^#/, '').toLowerCase() : ''))
    .filter(tag => tag && tag.length <= COPY_LIMITS.hashtag && /^[\p{L}_]+$/u.test(tag))

  return tags.length ? [...new Set(tags)].slice(0, COPY_LIMITS.hashtags) : null
}

export function cleanCopy(raw: unknown, fallback: IAdCopy): IAdCopy {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const kicker = field(input.kicker, COPY_LIMITS.kicker)
  const headline = field(typeof input.headline === 'string' ? input.headline.split(':')[0] : input.headline, COPY_LIMITS.headline)
  const intro = field(input.intro, COPY_LIMITS.intro, true)
  const cta = field(input.cta, COPY_LIMITS.cta)
  const hashtags = hashtagsOf(input.hashtags)

  return {
    kicker: kicker ?? fallback.kicker,
    headline: headline ?? fallback.headline,
    intro: intro ?? fallback.intro,
    cta: cta ?? fallback.cta,
    hashtags: hashtags ?? fallback.hashtags,
    ai: Boolean(kicker || headline || intro || cta),
    angle: fallback.angle,
  }
}

export function variantsOf(raw: unknown, facts: ICopyFacts, language: AdLanguage): IAdCopy[] {
  const list = Array.isArray(raw) ? raw : []

  const angleOf = (item: unknown): unknown => (item && typeof item === 'object' ? (item as { angle?: unknown }).angle : undefined)
  const labelled = list.some(item => AD_ANGLES.includes(angleOf(item) as AdAngle))

  return AD_ANGLES.map((angle, index) => {
    const found = labelled ? list.find(item => angleOf(item) === angle) : list[index]

    return cleanCopy(found, fallbackCopy(facts, language, angle))
  })
}

export function fallbackVariants(facts: ICopyFacts, language: AdLanguage): IAdCopy[] {
  return AD_ANGLES.map(angle => fallbackCopy(facts, language, angle))
}

export function editedCopy(raw: unknown, current: IAdCopy | undefined): IAdCopy | null {
  if (!raw || typeof raw !== 'object') return null

  const input = raw as Record<string, unknown>
  const text = (key: keyof typeof COPY_LIMITS, value: unknown): string =>
    typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, COPY_LIMITS[key]) : String(current?.[key as keyof IAdCopy] ?? '')

  return {
    kicker: text('kicker', input.kicker),
    headline: text('headline', input.headline),
    intro: text('intro', input.intro),
    cta: text('cta', input.cta),
    hashtags: hashtagsOf(input.hashtags) ?? (Array.isArray(input.hashtags) ? [] : current?.hashtags ?? []),
    ai: current?.ai ?? false,
    angle: current?.angle,
  }
}

export const voiceOf = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim().slice(0, MAX_VOICE) : ''
