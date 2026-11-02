import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { Observable } from 'rxjs'
import { CacheService } from '~/shared/cache/cache.service'
import { RouteLookupService } from '~/modules/references/route-lookup.service'
import type { ReferenceItem } from '~/modules/suppliers/dictionary/dictionary.contracts'
import { SearchService } from './search.service'
import { toCriteria } from './search.query'
import type { SearchQueryDto } from './search.query'
import { SupplierState } from './contracts/search'
import type { SearchCriteria } from './contracts/search'
import { Offer } from './models/Offer'
import { tashkentToday } from './hot'
import { byTheme, countriesOf, discountOf, entryOf, KIDS_PARTY, offerFor, showcaseWindow, themeOf } from './showcase'
import type { IShowcaseEntry, SavingKind, ShowcaseTheme } from './showcase'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IShowcaseQuery extends SearchQueryDto {
  theme?: string
}

export interface IShowcaseCard {
  country: { slug: string, label: string }
  offer: ReturnType<Offer['toObject']> | null
  offers: number
  discount: number
  discount_kind: SavingKind | null
}

export interface IRoutePlace {
  slug: string
  label: string
}

export interface IRouteSummary {
  from: IRoutePlace
  to: IRoutePlace
  offers: number | null
  offer: ReturnType<Offer['toObject']> | null
}

export interface IRoutePage {
  from: IRoutePlace
  to: IRoutePlace
  date: string
  date_to: string
  nights: { from: number, to: number }
  adults: number
  offers: number
  cheapest: ReturnType<Offer['toObject']> | null
  hotels: Array<ReturnType<Offer['toObject']>>
}

export type ShowcaseEvent =
  | { type: 'start', from: { slug: string, label: string }, theme: ShowcaseTheme, date: string, dateTo: string, countries: Array<{ slug: string, label: string }> }
  | { type: 'country', card: IShowcaseCard }
  | { type: 'done', cards: IShowcaseCard[] }

const SHOWCASE_TTL_MS = 4 * 60 * 60 * 1000

const WARM_EVERY_MS = 3 * 60 * 60 * 1000

const WARM_DELAY_MS = 60 * 1000

const LIVE_CONCURRENCY = 3

export const warmedDepartures = (): string[] =>
  (process.env.SHOWCASE_WARM_FROM || 'tashkent').split(',').map(slug => slug.trim()).filter(Boolean)

const placeOf = (item: ReferenceItem): IRoutePlace => ({ slug: item.slug, label: item.label })

async function inTurns<T>(items: T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items]

  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await work(item)
  }))
}

@Injectable()
export class ShowcaseService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ShowcaseService.name)

  private timer: NodeJS.Timeout | null = null

  private warming = false

  constructor(
    private readonly search: SearchService,
    private readonly routes: RouteLookupService,
    private readonly cache: CacheService,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.SHOWCASE_WARM === 'off' || process.env.NODE_ENV === 'test') return

    const first = setTimeout(() => void this.warm(), WARM_DELAY_MS)

    first.unref()
    this.timer = setInterval(() => void this.warm(), WARM_EVERY_MS)
    this.timer.unref()
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
  }

  stream(query: IShowcaseQuery): Observable<ShowcaseEvent> {
    return new Observable<ShowcaseEvent>((subscriber) => {
      const abort = new AbortController()

      void (async () => {
        const theme = themeOf(query.theme)
        const base = this.criteriaOf(query, theme)
        const departure = (await this.routes.departures()).items.find(item => item.slug === base.from)
        const countries = countriesOf((await this.routes.countriesFrom(base.from)).items, theme)
        const cards: IShowcaseCard[] = []

        subscriber.next({
          type: 'start',
          from: { slug: base.from, label: departure?.label ?? base.from },
          theme,
          date: base.dateFrom,
          dateTo: base.dateTo,
          countries: countries.map(({ slug, label }) => ({ slug, label })),
        })

        await inTurns(countries, LIVE_CONCURRENCY, async (country) => {
          if (abort.signal.aborted) return

          const entry = await this.entry(base, country, abort.signal)

          if (abort.signal.aborted || !entry) return

          const card = this.cardOf(country, entry, theme)

          if (!card.offer) return

          cards.push(card)
          subscriber.next({ type: 'country', card })
        })

        if (abort.signal.aborted) return

        subscriber.next({ type: 'done', cards: byTheme(cards, theme) })
        subscriber.complete()
      })().catch(error => subscriber.error(error))

      return () => abort.abort()
    })
  }

  async routeList(): Promise<{ items: IRouteSummary[] }> {
    const departures = (await this.routes.departures()).items
    const items: IRouteSummary[] = []

    for (const slug of warmedDepartures()) {
      const departure = departures.find(item => item.slug === slug)

      if (!departure) continue

      const base = this.criteriaOf({ from: slug }, 'all')

      for (const country of (await this.routes.countriesFrom(slug)).items) {
        const entry = await this.cache.getJson<IShowcaseEntry>(this.keyOf(base, country.slug))

        if (entry && !entry.offers) continue

        items.push({
          from: placeOf(departure),
          to: placeOf(country),
          offers: entry?.offers ?? null,
          offer: entry?.cheapest ? new Offer(entry.cheapest).toObject() : null,
        })
      }
    }

    return { items }
  }

  async routePage(from: string, to: string): Promise<IRoutePage> {
    const departure = (await this.routes.departures()).items.find(item => item.slug === from)
    const country = departure ? (await this.routes.countriesFrom(from)).items.find(item => item.slug === to) : undefined

    if (!departure || !country) throw new NotFoundException('Unknown route')

    const base = this.criteriaOf({ from }, 'all')
    const entry = await this.entry(base, country)

    return {
      from: placeOf(departure),
      to: placeOf(country),
      date: base.dateFrom,
      date_to: base.dateTo,
      nights: { from: base.nightsFrom, to: base.nightsTo },
      adults: base.adults,
      offers: entry?.offers ?? 0,
      cheapest: entry?.cheapest ? new Offer(entry.cheapest).toObject() : null,
      hotels: (entry?.hotels ?? []).map(offer => new Offer(offer).toObject()),
    }
  }

  private criteriaOf(query: IShowcaseQuery, theme: ShowcaseTheme): SearchCriteria {
    if (!query.from) throw new BadRequestException('from is required')

    const window = showcaseWindow(tashkentToday(), query.date, query.dateTo)
    const criteria = toCriteria({ ...query, to: query.from, date: window.dateFrom, dateTo: window.dateTo })

    if (theme !== 'kids') return criteria

    return {
      ...criteria,
      adults: KIDS_PARTY.adults,
      childrenAges: [...KIDS_PARTY.childrenAges],
      filters: { ...criteria.filters, meals: [...KIDS_PARTY.meals] },
    }
  }

  private keyOf(base: SearchCriteria, country: string): string {
    const sent = {
      from: base.from,
      dateFrom: base.dateFrom,
      dateTo: base.dateTo,
      nightsFrom: base.nightsFrom,
      nightsTo: base.nightsTo,
      adults: base.adults,
      childrenAges: [...base.childrenAges].sort((a, b) => a - b),
      currency: base.currency,
      meals: [...base.filters.meals].sort(),
      stars: [...base.filters.stars].sort(),
    }

    return `showcase:v4:${createHash('sha1').update(JSON.stringify(sent)).digest('hex')}:${country}`
  }

  private async entry(base: SearchCriteria, country: ReferenceItem, signal?: AbortSignal, fresh = false): Promise<IShowcaseEntry | null> {
    const key = this.keyOf(base, country.slug)

    if (!fresh) {
      const stored = await this.cache.getJson<IShowcaseEntry>(key)

      if (stored) return stored
    }

    const page = await this.search.fetchPage({ ...base, to: country.slug }, 1, signal).catch(() => null)

    if (!page || signal?.aborted) return null

    const entry = entryOf(page.offers.map(offer => offer.payload()))
    const answered = page.statuses.some(status => status.state === SupplierState.Done)

    if (answered) await this.cache.setJson(key, entry, SHOWCASE_TTL_MS)

    return entry
  }

  private cardOf(country: ReferenceItem, entry: IShowcaseEntry, theme: ShowcaseTheme): IShowcaseCard {
    const offer = offerFor(entry, theme)

    return {
      country: { slug: country.slug, label: country.label },
      offer: offer ? new Offer(offer).toObject() : null,
      offers: entry.offers,
      discount: theme === 'discount' ? entry.saving : offer ? discountOf(offer) : 0,
      discount_kind: theme === 'discount' ? entry.savingKind : offer && discountOf(offer) ? 'old_price' : null,
    }
  }

  private async warm(): Promise<void> {
    if (this.warming) return

    this.warming = true

    try {
      for (const from of warmedDepartures()) {
        const countries = (await this.routes.countriesFrom(from)).items

        for (const theme of ['all', 'kids'] as const) {
          const base = this.criteriaOf({ from }, theme)
          const started = Date.now()

          await inTurns(countries, 1, async (country) => {
            await this.entry(base, country, undefined, true)
          })

          this.logger.log(`showcase ${from}/${theme}: ${countries.length} countries in ${Math.round((Date.now() - started) / 1000)} s`)
        }
      }
    }
    catch (error) {
      this.logger.warn(`showcase warm failed: ${String(error)}`)
    }
    finally {
      this.warming = false
    }
  }
}
