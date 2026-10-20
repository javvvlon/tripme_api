import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { SearchService } from '~/modules/search/search.service'
import { FLEXIBLE_NIGHTS } from '~/modules/search/search.query'
import { tashkentToday } from '~/modules/search/hot'
import type { IOffer, Offer } from '~/modules/search/models/Offer'
import { RouteLookupService } from '~/modules/references/route-lookup.service'
import type { ReferenceItem } from '~/modules/suppliers/dictionary/dictionary.contracts'
import { GeminiClient } from '~/shared/ai/gemini.client'
import type { IGeminiImage } from '~/shared/ai/gemini.client'
import { MAX_TOURS } from '../marketing.rules'
import type { IAdTour } from '../selection.entity'
import { flagCountries, INTAKE_RULES, intakePrompt, isOwnOffer, labelMatch, ownTours, pickOffer, POST_ADULTS, postFactsOf, postGap, searchDates, tourFromOffer, tourFromPost } from './post'
import type { IIntakeReport, IIntakeRoute, IPostFacts, IPostHotel } from './post'
import { embeddedPostOf, embedUrl, isPrivateLink, postLinkOf } from './link'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IIntakeInput {
  text: string
  origin?: string
  image?: IGeminiImage | null
}

export interface IIntakePost {
  text: string
  origin: string
  link: string
  image: IGeminiImage | null
}

export interface IIntakeResult {
  post: IIntakePost
  facts: IPostFacts
  route: IIntakeRoute | null
  tours: IAdTour[]
  report: IIntakeReport
}

const HOME = 'tashkent'

const SEARCH_TIMEOUT_MS = 60_000

const SUGGESTIONS = 5

const LINK_TIMEOUT_MS = 15_000

const MAX_PICTURE_BYTES = 8 * 1024 * 1024

const TELEGRAM_CDN = /(^|\.)(telesco\.pe|telegram\.org|t\.me)$/i

type Priced = IOffer & { mealPlan?: string | null }

@Injectable()
export class IntakeService {
  private readonly logger = new Logger(IntakeService.name)

  constructor(
    private readonly gemini: GeminiClient,
    private readonly search: SearchService,
    private readonly routes: RouteLookupService,
  ) {}

  get configured(): boolean {
    return this.gemini.configured
  }

  async run(input: IIntakeInput): Promise<IIntakeResult> {
    if (!this.gemini.configured) throw new ServiceUnavailableException('GEMINI_API_KEY is not set')

    const post = await this.postOf(input)
    const today = tashkentToday()
    const departures = (await this.routes.departures()).items
    const home = departures.find(item => item.slug === HOME) ?? departures[0] ?? null
    const homeCountries = home ? (await this.routes.countriesFrom(home.slug)).items : []

    const raw = await this.gemini.json<unknown>(INTAKE_RULES, intakePrompt({
      text: post.text,
      origin: post.origin,
      countries: homeCountries.map(item => item.label),
      today,
      image: Boolean(post.image),
    }), { images: post.image ? [post.image] : [], temperature: 0 })

    const facts = postFactsOf(raw, { countries: homeCountries, today })
    const flagged = flagCountries(post.text, homeCountries)

    if (!facts.country && flagged[0]) facts.country = flagged[0].label

    if (flagged.length > 1 && facts.legs.length > 1) {
      facts.legs = facts.legs.map((leg, index) => ({ ...leg, country: leg.country || flagged[index]?.label || '' }))
    }
    const route = await this.routeOf(facts, departures, home, homeCountries)
    const report: IIntakeReport = { country: facts.country, operator: facts.operator, found: 0, kept: 0, skipped: [] }

    if (isOwnOffer(facts)) {
      const slugs = [...new Set([route?.to, ...facts.legs.map(leg => labelMatch(leg.country, homeCountries)?.slug)].filter((slug): slug is string => Boolean(slug)))]
      const own = ownTours(facts, route, slugs)
      const tours = own.tours.slice(0, MAX_TOURS)

      report.skipped.push(...own.skipped, ...own.tours.slice(MAX_TOURS).map(tour => ({ hotel: tour.hotel_name, reason: 'limit' as const })))
      report.kept = tours.length
      report.own = true
      report.country = report.country || String(tours[0]?.route_to_label ?? '')

      return { post, facts, route, tours, report }
    }

    if (!route) return { post, facts, route, tours: [], report }

    const keys = await this.keysOf(facts.hotels, route)
    const offers = await this.offersOf(facts, route, [...new Set([...keys.values()])], today)
    const found: IAdTour[] = []
    const kept: IAdTour[] = []

    for (const hotel of facts.hotels) {
      const key = keys.get(hotel)
      const offer = key ? pickOffer(key, hotel, facts.operator, offers.map(item => item.priced), this.priceOf(offers)) : null

      if (offer) {
        found.push(tourFromOffer(offer, route))
        continue
      }

      const gap = postGap(hotel, facts)
      const tour = gap ? null : tourFromPost(hotel, facts, route)

      if (tour) kept.push(tour)
      else report.skipped.push({ hotel: hotel.name, reason: gap ?? 'no_price' })
    }

    const tours = [...found, ...kept].slice(0, MAX_TOURS)

    for (const tour of [...found, ...kept].slice(MAX_TOURS)) report.skipped.push({ hotel: tour.hotel_name, reason: 'limit' })

    report.found = tours.filter(tour => tour.source === 'search').length
    report.kept = tours.length - report.found

    return { post, facts, route, tours, report }
  }

  private async postOf(input: IIntakeInput): Promise<IIntakePost> {
    if (isPrivateLink(input.text)) throw new BadRequestException('This post is in a private channel. Forward it or paste its text')

    const link = postLinkOf(input.text)

    if (!link) return { text: input.text, origin: input.origin ?? '', link: '', image: input.image ?? null }

    const html = await fetch(embedUrl(link), { signal: AbortSignal.timeout(LINK_TIMEOUT_MS) })
      .then(response => (response.ok ? response.text() : ''))
      .catch(() => '')
    const embedded = html ? embeddedPostOf(html) : null

    if (!embedded || (!embedded.text && !embedded.imageUrl)) throw new BadRequestException('Telegram does not show this post publicly. Forward it or paste its text')

    return {
      text: embedded.text,
      origin: embedded.origin || `@${link.channel}`,
      link: link.url,
      image: input.image ?? (embedded.imageUrl ? await this.picture(embedded.imageUrl) : null),
    }
  }

  private async picture(url: string): Promise<IGeminiImage | null> {
    try {
      if (!TELEGRAM_CDN.test(new URL(url).hostname)) return null

      const response = await fetch(url, { signal: AbortSignal.timeout(LINK_TIMEOUT_MS) })
      const mimeType = (response.headers.get('content-type') ?? '').split(';')[0]!.trim()

      if (!response.ok || !/^image\/(png|jpe?g|webp)$/.test(mimeType)) return null

      const data = Buffer.from(await response.arrayBuffer())

      return data.length && data.length <= MAX_PICTURE_BYTES ? { mimeType, data } : null
    }
    catch (error) {
      this.logger.warn(`intake picture ${url}: ${String(error)}`)

      return null
    }
  }

  private async routeOf(facts: IPostFacts, departures: ReferenceItem[], home: ReferenceItem | null, homeCountries: ReferenceItem[]): Promise<IIntakeRoute | null> {
    if (!facts.country || !home) return null

    const from = labelMatch(facts.from, departures) ?? home

    if (from.slug !== home.slug) {
      const countries = (await this.routes.countriesFrom(from.slug)).items
      const to = labelMatch(facts.country, countries)

      if (to) return { from: from.slug, to: to.slug, toLabel: to.label }
    }

    const to = labelMatch(facts.country, homeCountries)

    return to ? { from: home.slug, to: to.slug, toLabel: to.label } : null
  }

  private async keysOf(hotels: IPostHotel[], route: IIntakeRoute): Promise<Map<IPostHotel, string>> {
    const keys = new Map<IPostHotel, string>()

    await Promise.all(hotels.map(async (hotel) => {
      const words = hotel.name.split(/\s+/).filter(Boolean)

      for (let size = words.length; size >= Math.min(2, words.length); size--) {
        const suggestions = await this.search.hotels(route.from, route.to, words.slice(0, size).join(' '), SUGGESTIONS).catch(() => [])
        const best = suggestions.find(item => hotel.stars && item.stars === hotel.stars) ?? suggestions[0]

        if (best) {
          keys.set(hotel, best.key)
          return
        }
      }
    }))

    return keys
  }

  private async offersOf(facts: IPostFacts, route: IIntakeRoute, keys: string[], today: string): Promise<Array<{ priced: Priced, offer: Offer }>> {
    if (!keys.length) return []

    const pages = await Promise.all(searchDates(facts, today).map(async (window) => {
      try {
        const page = await this.search.fetchPage({
          from: route.from,
          to: route.to,
          dateFrom: window.dateFrom,
          dateTo: window.dateTo,
          nightsFrom: facts.nights ?? FLEXIBLE_NIGHTS.from,
          nightsTo: facts.nights ?? FLEXIBLE_NIGHTS.to,
          adults: POST_ADULTS,
          childrenAges: [],
          currency: 'USD',
          filters: { stars: [], meals: [], resorts: [], hotels: keys, suppliers: [] },
        }, 1, AbortSignal.timeout(SEARCH_TIMEOUT_MS))

        return page.offers
      }
      catch (error) {
        this.logger.warn(`intake search ${route.to} ${window.dateFrom}: ${String(error)}`)

        return []
      }
    }))

    return pages.flat().map(offer => ({ priced: offer.toObject() as Priced, offer }))
  }

  private priceOf(offers: Array<{ priced: Priced, offer: Offer }>): (offer: IOffer) => number {
    const byId = new Map(offers.map(item => [item.priced.id, item.offer.comparePrice()]))

    return offer => byId.get(offer.id) ?? offer.price.source.amount
  }
}
