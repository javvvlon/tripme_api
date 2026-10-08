import type { IOrderItemPayload } from '../items/order-items.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IDocumentLine {
  kind: string
  title: string
  when: string
  price: string
  uzs: number | null
}

export interface IDocumentMoney {
  lines: IDocumentLine[]
  totalUzs: number
  missingRates: number
  receivedUzs: number
  balanceUzs: number
}

const KIND_LABELS: Record<string, string> = {
  package: 'Турпакет',
  flight: 'Авиабилет',
  hotel: 'Отель',
  transfer: 'Трансфер',
  insurance: 'Страховка',
  excursion: 'Экскурсия',
  visa: 'Виза',
}

const INACTIVE = ['cancelled', 'rejected']

const day = (value: string | null): string => {
  if (!value) return ''

  const [year, month, date] = value.split('-')

  return date && month && year ? `${date}.${month}.${year}` : value
}

export const formatAmount = (amount: number, currency: string): string =>
  `${(Math.round(amount * 100) / 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${currency === 'UZS' ? 'сум' : currency}`.trim()

export function documentLinesOf(items: IOrderItemPayload[]): IDocumentLine[] {
  return items
    .filter(item => !INACTIVE.includes(item.status))
    .map(item => ({
      kind: KIND_LABELS[item.kind] ?? item.kind,
      title: item.title || KIND_LABELS[item.kind] || item.kind,
      when: [day(item.service_start), day(item.service_end)].filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join(' — '),
      price: item.price_amount === null ? '—' : formatAmount(item.price_amount, item.price_currency || 'UZS'),
      uzs: item.price_uzs,
    }))
}

export function documentMoneyOf(items: IOrderItemPayload[], receivedUzs: number, balanceUzs: number): IDocumentMoney {
  const lines = documentLinesOf(items)

  return {
    lines,
    totalUzs: lines.reduce((total, line) => total + (line.uzs ?? 0), 0),
    missingRates: lines.filter(line => line.uzs === null).length,
    receivedUzs,
    balanceUzs,
  }
}
