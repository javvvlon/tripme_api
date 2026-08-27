import { readFileSync } from 'node:fs'
import { Logger } from '@nestjs/common'
import { slugify } from './slug'
import { COUNTRY_LABELS, DEPARTURE_LABELS } from './dictionary.seed'
import type { ReferenceItem } from './dictionary.contracts'
import type { RouteConstraints } from '~/modules/suppliers/base/contracts'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
interface RefOption { value: string, label: string }

const TTL_MS = 8 * 60 * 60 * 1000

export class SupplierDictionary {
  private readonly logger: Logger

  private options = new Map<string, RefOption[]>()

  private rates = new Map<string, Map<string, number>>()
  private fetchedAt = 0
  private hydrating: Promise<void> | null = null

  private readonly learned = new Map<string, string>()

  constructor(
    private readonly supplierId: string,
    private readonly loadPage: () => Promise<string>,
    seedPath?: string,
  ) {
    this.logger = new Logger(`${SupplierDictionary.name}:${supplierId}`)

    if (seedPath) this.seed(seedPath)
  }

  private seed(path: string): void {
    try {
      const data = JSON.parse(readFileSync(path, 'utf8')) as { selects?: Record<string, RefOption[]> }

      for (const [field, options] of Object.entries(data.selects ?? {})) {
        this.options.set(field, options)
      }
    }
    catch (error) {
      this.logger.warn(`seed ${path} not loaded: ${String(error)}`)
    }
  }

  async hydrate(): Promise<void> {
    if (Date.now() - this.fetchedAt < TTL_MS) return
    if (this.hydrating) return this.hydrating

    this.hydrating = (async () => {
      try {
        const html = await this.loadPage()
        const parsed = new Map<string, RefOption[]>()

        for (const field of ['TOWNFROMINC', 'STATEINC', 'NIGHTS_FROM', 'ADULT', 'CHILD']) {
          const options = parseSelect(html, field)
          if (options.length) parsed.set(field, options)
        }

        if (!parsed.has('TOWNFROMINC')) {
          throw new Error('no TOWNFROMINC select on the page')
        }

        for (const [field, options] of parsed) this.options.set(field, options)

        this.rates = parseCrossRates(html)

        this.fetchedAt = Date.now()
        this.logger.log(
          `${parsed.get('TOWNFROMINC')?.length ?? 0} departures, `
          + `${parsed.get('STATEINC')?.length ?? 0} destinations`)
      }
      catch (error) {
        this.logger.warn(`hydrate failed, keeping ${this.options.size} cached selects: ${String(error)}`)
      }
      finally {
        this.hydrating = null
      }
    })()

    return this.hydrating
  }

  private slugFor(map: Record<string, string[]>, label: string): string {
    const needle = label.trim().toLowerCase()

    for (const [slug, aliases] of Object.entries(map)) {
      if (aliases.some(alias => alias.trim().toLowerCase() === needle)) return slug
    }

    return slugify(label)
  }

  private items(field: string, labels: Record<string, string[]>): ReferenceItem[] {
    return (this.options.get(field) ?? [])
      .map(option => ({
        slug: this.slugFor(labels, option.label),
        label: option.label.trim(),
        code: option.value,
      }))
      .filter(item => item.slug && item.label)
  }

  async departures(): Promise<ReferenceItem[]> {
    await this.hydrate()

    return this.items('TOWNFROMINC', DEPARTURE_LABELS)
  }

  async countries(): Promise<ReferenceItem[]> {
    await this.hydrate()

    return this.items('STATEINC', COUNTRY_LABELS)
  }

  async departureCode(slug: string): Promise<string | null> {
    return (await this.departures()).find(item => item.slug === slug)?.code ?? null
  }

  async countryCode(slug: string): Promise<string | null> {
    const learned = this.learned.get(slug)
    if (learned) return learned

    return (await this.countries()).find(item => item.slug === slug)?.code ?? null
  }

  rememberCountries(items: ReferenceItem[]): void {
    for (const item of items) this.learned.set(item.slug, item.code)
  }

  routeConstraints(): RouteConstraints {
    const numbers = (field: string) =>
      (this.options.get(field) ?? [])
        .map(option => Number(option.value))
        .filter(Number.isFinite)

    const adults = numbers('ADULT')
    const children = numbers('CHILD')

    return {
      validCheckIn: null,
      nights: numbers('NIGHTS_FROM').sort((a, b) => a - b),
      maxAdults: adults.length ? Math.max(...adults) : 1,
      maxChildren: children.length ? Math.max(...children) : 0,
    }
  }

  rate(fromCode: string, toCode: string): number | null {
    if (fromCode === toCode) return 1

    return this.rates.get(fromCode)?.get(toCode) ?? null
  }

  get id(): string {
    return this.supplierId
  }
}

function parseCrossRates(html: string): Map<string, Map<string, number>> {
  const table = new Map<string, Map<string, number>>()
  const match = /samo\.CROSS_RATES\s*=\s*(\{[\s\S]*?\});/.exec(html)

  if (!match) return table

  try {
    const parsed = JSON.parse(match[1]) as Record<string, Record<string, unknown>>

    for (const [from, row] of Object.entries(parsed)) {
      const to = new Map<string, number>()

      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'number' && /^\d+$/.test(key)) to.set(key, value)
      }

      table.set(from, to)
    }
  }
  catch {
  }

  return table
}

function parseSelect(html: string, name: string): RefOption[] {
  const select = new RegExp(`<select[^>]*name="${name}"[^>]*>([\\s\\S]*?)</select>`).exec(html)
  if (!select) return []

  return [...select[1].matchAll(/<option[^>]*value="(\d+)"[^>]*>([^<]*)<\/option>/g)]
    .map(([, value, label]) => ({ value, label: decodeEntities(label).trim() }))
    .filter(option => option.label)
}

function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, '\'')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}
