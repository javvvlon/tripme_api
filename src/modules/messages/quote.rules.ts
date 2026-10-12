import { BadRequestException } from '@nestjs/common'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export enum MessageKind {
  Text = 'text',
  Quote = 'quote',
}

export type VariantDecision = 'accepted' | 'declined'

export const VARIANT_DECISIONS: VariantDecision[] = ['accepted', 'declined']

export const QUOTE_MAX_VARIANTS = 3

export interface IQuoteVariant {
  n: number
  title: string
  summary: string
  price: string
  trip: Record<string, unknown>
  decision: VariantDecision | null
  decided_at: string | null
}

export interface IQuoteData {
  lead_id: string
  lead_ref: string
  locale: string
  variants: IQuoteVariant[]
}

const text = (value: unknown, limit: number): string =>
  typeof value === 'string' ? value.trim().slice(0, limit) : ''

export function quoteVariants(raw: unknown): IQuoteVariant[] {
  const list = Array.isArray(raw) ? raw : []

  if (!list.length || list.length > QUOTE_MAX_VARIANTS) {
    throw new BadRequestException(`An offer needs 1 to ${QUOTE_MAX_VARIANTS} variants`)
  }

  return list.map((entry, index) => {
    const item = (entry ?? {}) as Record<string, unknown>
    const trip = item.trip && typeof item.trip === 'object' ? item.trip as Record<string, unknown> : {}
    const title = text(item.title, 200)

    if (!title || !text(trip.hotel_name, 240)) throw new BadRequestException('Every variant needs a hotel')

    return {
      n: index + 1,
      title,
      summary: text(item.summary, 300),
      price: text(item.price, 80),
      trip,
      decision: null,
      decided_at: null,
    }
  })
}

export function decide(data: IQuoteData, n: number, decision: VariantDecision, at: Date): IQuoteData {
  if (!VARIANT_DECISIONS.includes(decision)) throw new BadRequestException('Unknown decision')
  if (!data.variants.some(variant => variant.n === n)) throw new BadRequestException('Unknown variant')

  return {
    ...data,
    variants: data.variants.map((variant) => {
      if (variant.n === n) return { ...variant, decision, decided_at: at.toISOString() }
      if (decision === 'accepted' && variant.decision === 'accepted') return { ...variant, decision: null, decided_at: null }

      return variant
    }),
  }
}

const REPLIES: Record<string, Record<VariantDecision, string>> = {
  ru: { accepted: '✅ Вариант {n} подходит: {title}', declined: '✖ Вариант {n} не подходит: {title}' },
  uz: { accepted: '✅ {n}-variant mos keladi: {title}', declined: '✖ {n}-variant mos kelmaydi: {title}' },
  en: { accepted: '✅ Variant {n} works for me: {title}', declined: '✖ Variant {n} does not work for me: {title}' },
}

export function decisionReply(locale: string, variant: IQuoteVariant, decision: VariantDecision): string {
  return (REPLIES[locale] ?? REPLIES.ru)[decision]
    .replace('{n}', String(variant.n))
    .replace('{title}', variant.title)
}
