import { existsSync } from 'node:fs'
import PDFDocument from 'pdfkit'
import { formatAmount } from './document-lines'
import type { IDocumentMoney } from './document-lines'
import { LOGO_HEIGHT, LOGO_ME, LOGO_SUITCASE, LOGO_TRIP, LOGO_WIDTH } from './logo'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IDocumentParty {
  name: string
  phone: string
}

export interface IDocumentTrip {
  country: string
  hotel: string
  supplier: string
  checkIn: string | null
  returnDate: string | null
  nights: number
  adults: number
  children: number
  room: string
  meal: string
}

export interface IDocumentTotals {
  amount: number | null
  currency: string
}

export interface IDocumentData {
  number: string
  issuedOn: Date
  client: IParty
  trip: IDocumentTrip
  totals: IDocumentTotals
  money?: IDocumentMoney
  note: string
  supplierOrderId: string
}

type IParty = IDocumentParty

export const LEGAL_LINE = 'ООО «TRIPME» · ИНН 310886482 · Лицензия №158946'

const NAVY = '#0B192C'
const SLATE = '#334155'
const MUTED = '#5B6B80'
const SURFACE = '#F8F9FA'
const BORDER = '#CBD5E1'
const WHITE = '#FFFFFF'
const LOGO_INK = '#0A0A0A'
const LOGO_ACCENT = '#FF6B00'

const MM = 72 / 25.4
const MARGIN = 20 * MM
const WIDTH = 595.28
const HEIGHT = 841.89
const CONTENT = WIDTH - MARGIN * 2
const FOOTER_TOP = HEIGHT - MARGIN - 32
const LOGO_MM = 38

const CELL_Y = 4.5
const CELL_X = 9

type FontRole = 'heading' | 'eyebrow' | 'body' | 'strong' | 'mono'

const FONTS: Record<FontRole, [pkg: string, family: string, weight: string]> = {
  heading: ['montserrat', 'Montserrat', '700Bold'],
  eyebrow: ['montserrat', 'Montserrat', '600SemiBold'],
  body: ['nunito', 'Nunito', '400Regular'],
  strong: ['nunito', 'Nunito', '700Bold'],
  mono: ['jetbrains-mono', 'JetBrainsMono', '500Medium'],
}

const fontFile = ([pkg, family, weight]: [string, string, string]): string | null => {
  try {
    const entry = require.resolve(`@expo-google-fonts/${pkg}/package.json`)
    const path = entry.replace(/package\.json$/, `${weight}/${family}_${weight}.ttf`)

    return existsSync(path) ? path : null
  }
  catch {
    return null
  }
}

const money = (amount: number | null, currency: string): string => {
  if (amount === null) return '—'

  const grouped = Math.round(amount * 100) / 100

  return `${grouped.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${currency}`.trim()
}

const localDay = (at: Date): string => {
  const pad = (value: number) => String(value).padStart(2, '0')

  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
}

const day = (value: string | null): string => {
  if (!value) return '—'

  const [year, month, date] = value.split('-')

  return date && month && year ? `${date}.${month}.${year}` : value
}

export type DocumentFlavour = 'offer' | 'invoice'

const TITLES: Record<DocumentFlavour, string> = {
  offer: 'Коммерческое предложение',
  invoice: 'Счёт на оплату',
}

export function buildDocument(flavour: DocumentFlavour, data: IDocumentData): Promise<Buffer> {
  const files = Object.entries(FONTS).map(([role, spec]) => [role, fontFile(spec)] as const)

  if (files.some(([, file]) => !file)) {
    return Promise.reject(new Error('The document font is missing — reinstall dependencies'))
  }

  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, info: {
    Title: `${TITLES[flavour]} ${data.number}`,
    Author: 'TRIPME',
  } })

  for (const [role, file] of files) doc.registerFont(role, file!)

  const chunks: Buffer[] = []

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk as Buffer))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  header(doc, flavour, data)
  parties(doc, data)
  trip(doc, data)
  services(doc, data)
  totals(doc, flavour, data)
  footer(doc, flavour)

  doc.end()

  return done
}

function logo(doc: PDFKit.PDFDocument, x: number, y: number, width: number): number {
  const scale = width / LOGO_WIDTH

  doc.save().translate(x, y).scale(scale)
  doc.path(LOGO_TRIP).fill(LOGO_INK)
  doc.path(LOGO_ME).fill(LOGO_ACCENT)

  for (const part of LOGO_SUITCASE) doc.path(part).fill(LOGO_ACCENT)

  doc.restore()

  return LOGO_HEIGHT * scale
}

function header(doc: PDFKit.PDFDocument, flavour: DocumentFlavour, data: IDocumentData): void {
  const height = logo(doc, MARGIN, MARGIN, LOGO_MM * MM)
  const legalTop = MARGIN + height + 6

  doc.fillColor(MUTED).font('body').fontSize(8.5).text(LEGAL_LINE, MARGIN, legalTop, { lineBreak: false })

  const numberWidth = doc.font('mono').fontSize(10).widthOfString(data.number)
  const signWidth = doc.font('body').fontSize(10).widthOfString('№ ')

  doc.fillColor(MUTED).font('body').fontSize(10)
    .text('№ ', WIDTH - MARGIN - numberWidth - signWidth, MARGIN, { lineBreak: false })
  doc.fillColor(NAVY).font('mono').fontSize(10)
    .text(data.number, WIDTH - MARGIN - numberWidth, MARGIN + 1, { lineBreak: false })
  doc.fillColor(MUTED).font('body').fontSize(9.5)
    .text(`от ${day(localDay(data.issuedOn))}`, MARGIN, MARGIN + 18, { width: CONTENT, align: 'right' })

  const rule = legalTop + 18

  hairline(doc, rule)

  doc.fillColor(SLATE).font('eyebrow').fontSize(9)
    .text(flavour === 'offer' ? 'TRIPME • КП' : 'TRIPME • СЧЁТ', MARGIN, rule + 14, { characterSpacing: 0.6 })
  doc.fillColor(NAVY).font('heading').fontSize(20)
    .text(TITLES[flavour], MARGIN, rule + 27, { width: CONTENT })

  doc.y = rule + 58
}

function parties(doc: PDFKit.PDFDocument, data: IDocumentData): void {
  heading(doc, 'Клиент')

  doc.fillColor(SLATE).font('strong').fontSize(11).text(data.client.name || '—', MARGIN, doc.y)

  if (data.client.phone) {
    doc.fillColor(MUTED).font('body').fontSize(10).text(data.client.phone, MARGIN, doc.y + 2)
  }

  doc.y += 10
}

interface IFact {
  label: string
  value: string
  detail?: string
  code?: boolean
}

function trip(doc: PDFKit.PDFDocument, data: IDocumentData): void {
  heading(doc, 'Тур')

  const nights = data.trip.nights ? `, ${data.trip.nights} ${plural(data.trip.nights, ['ночь', 'ночи', 'ночей'])}` : ''
  const stay = [data.trip.room, data.trip.meal].filter(Boolean).join(' · ')
  const rows: IFact[] = [
    { label: 'Направление', value: data.trip.country || '—' },
    { label: 'Отель', value: data.trip.hotel || '—', detail: stay },
    { label: 'Туроператор', value: data.trip.supplier || '—' },
    { label: 'Даты', value: `${day(data.trip.checkIn)} — ${day(data.trip.returnDate)}${nights}` },
    { label: 'Туристы', value: travellers(data.trip) },
  ]

  if (data.supplierOrderId) rows.push({ label: 'Номер брони', value: data.supplierOrderId, code: true })

  facts(doc, rows)
}

function plural(count: number, forms: [string, string, string]): string {
  const tens = count % 100
  const ones = count % 10

  if (tens > 10 && tens < 20) return forms[2]
  if (ones === 1) return forms[0]
  if (ones >= 2 && ones <= 4) return forms[1]

  return forms[2]
}

function travellers(from: IDocumentTrip): string {
  const parts = [`взрослых — ${from.adults || 0}`]

  if (from.children) parts.push(`детей — ${from.children}`)

  return parts.join(', ')
}

function services(doc: PDFKit.PDFDocument, data: IDocumentData): void {
  const lines = data.money?.lines ?? []

  if (!lines.length) return

  heading(doc, 'Услуги')

  const priceWidth = 104
  const uzsWidth = 124
  const nameWidth = CONTENT - priceWidth - uzsWidth
  const columns = [
    { x: MARGIN, width: nameWidth, align: 'left' as const },
    { x: MARGIN + nameWidth, width: priceWidth, align: 'right' as const },
    { x: MARGIN + nameWidth + priceWidth, width: uzsWidth, align: 'right' as const },
  ]

  const head = (): void => {
    const top = doc.y

    doc.rect(MARGIN, top, CONTENT, 22).fill(NAVY)
    ;['Услуга', 'Цена', 'В сумах'].forEach((title, index) => {
      const column = columns[index]!

      doc.fillColor(WHITE).font('heading').fontSize(9.5)
        .text(title, column.x + CELL_X, top + 6, { width: column.width - CELL_X * 2, align: column.align })
    })
    doc.y = top + 22
  }

  head()

  lines.forEach((line, index) => {
    const title = `${line.kind}: ${line.title}`
    const textWidth = nameWidth - CELL_X * 2
    const titleHeight = doc.font('strong').fontSize(10).heightOfString(title, { width: textWidth })
    const whenHeight = line.when ? doc.font('body').fontSize(8.5).heightOfString(line.when, { width: textWidth }) + 2 : 0
    const height = titleHeight + whenHeight + CELL_Y * 2

    if (ensure(doc, height)) head()

    const top = doc.y

    if (index % 2 === 1) doc.rect(MARGIN, top, CONTENT, height).fill(SURFACE)

    doc.fillColor(SLATE).font('strong').fontSize(10).text(title, MARGIN + CELL_X, top + CELL_Y, { width: textWidth })

    if (line.when) {
      doc.fillColor(MUTED).font('body').fontSize(8.5).text(line.when, MARGIN + CELL_X, top + CELL_Y + titleHeight + 2, { width: textWidth })
    }

    doc.fillColor(SLATE).font('mono').fontSize(9.5)
      .text(line.price, columns[1]!.x + CELL_X, top + CELL_Y + 1, { width: priceWidth - CELL_X * 2, align: 'right' })
    doc.fillColor(NAVY).font('mono').fontSize(9.5)
      .text(line.uzs === null ? '—' : formatAmount(line.uzs, 'сум'), columns[2]!.x + CELL_X, top + CELL_Y + 1, { width: uzsWidth - CELL_X * 2, align: 'right' })

    doc.y = top + height
    hairline(doc, doc.y)
  })

  doc.y += 12
}

function rateRow(summary: IDocumentMoney): [string, string] {
  const date = (summary.ratesDate ?? '').split('-').reverse().join('.')
  const label = summary.ratesBasis === 'operator' ? `Курс туроператора на ${date}` : `Курс ЦБ + 2% на ${date}`

  return summary.rate ? [label, `1 ${summary.rate.currency} = ${formatAmount(summary.rate.value, 'сум')}`] : [label, '']
}

function totals(doc: PDFKit.PDFDocument, flavour: DocumentFlavour, data: IDocumentData): void {
  const summary = data.money
  const rows: Array<[string, string]> = summary
    ? flavour === 'invoice'
      ? [
          ['Итого', formatAmount(summary.totalUzs, 'сум')],
          ['Оплачено', formatAmount(summary.receivedUzs, 'сум')],
          ...(summary.ratesDate && summary.balanceUzs > 0
            ? [rateRow(summary)]
            : []),
        ]
      : []
    : []

  const headline = summary
    ? flavour === 'invoice' ? formatAmount(summary.balanceUzs, 'сум') : formatAmount(summary.totalUzs, 'сум')
    : money(data.totals.amount, data.totals.currency)

  const height = 52 + rows.length * 16

  ensure(doc, height + 12)

  const top = doc.y

  doc.rect(MARGIN, top, CONTENT, height).fill(SURFACE)
  doc.rect(MARGIN, top, 3, height).fill(NAVY)

  rows.forEach(([name, value], index) => {
    const y = top + 12 + index * 16

    doc.fillColor(MUTED).font('body').fontSize(10).text(name, MARGIN + 18, y)
    doc.fillColor(SLATE).font('mono').fontSize(9.5).text(value, MARGIN + 18, y + 1, { width: CONTENT - 36, align: 'right' })
  })

  const headTop = top + 12 + rows.length * 16

  doc.fillColor(MUTED).font('body').fontSize(10)
    .text(flavour === 'invoice' ? 'К оплате' : summary ? 'Итого' : 'Стоимость тура', MARGIN + 18, headTop)

  doc.fillColor(NAVY).font('heading').fontSize(18)
    .text(headline, MARGIN + 18, headTop + 14)

  doc.y = top + height + 12

  if (summary?.missingRates) {
    doc.fillColor(MUTED).font('body').fontSize(8.5)
      .text('Часть услуг без курса к суму — итог уточнит менеджер.', MARGIN, doc.y - 8, { width: CONTENT })
    doc.y += 6
  }

  if (!data.note) return

  heading(doc, 'Примечание', doc.font('body').fontSize(10).heightOfString(data.note, { width: CONTENT }))
  doc.fillColor(SLATE).font('body').fontSize(10).text(data.note, MARGIN, doc.y, { width: CONTENT })
  doc.y += 8
}

function footer(doc: PDFKit.PDFDocument, flavour: DocumentFlavour): void {
  const note = flavour === 'offer'
    ? 'Предложение носит информационный характер. Стоимость и наличие мест подтверждаются на момент бронирования.'
    : 'Оплата подтверждает согласие с условиями бронирования. Реквизиты уточняйте у менеджера.'

  hairline(doc, FOOTER_TOP)

  doc.fillColor(MUTED).font('body').fontSize(8.5)
    .text(note, MARGIN, FOOTER_TOP + 8, { width: CONTENT })
}

function heading(doc: PDFKit.PDFDocument, text: string, following = 22): void {
  ensure(doc, 18 + following)

  doc.fillColor(NAVY).font('heading').fontSize(12).text(text, MARGIN, doc.y + 2)

  doc.y += 5
}

function facts(doc: PDFKit.PDFDocument, rows: IFact[]): void {
  const labelWidth = 150
  const valueWidth = CONTENT - labelWidth - CELL_X * 2

  hairline(doc, doc.y)

  rows.forEach((row, index) => {
    const valueFont = row.code ? 'mono' : 'body'
    const valueHeight = Math.max(doc.font(valueFont).fontSize(9.5).heightOfString(row.value, { width: valueWidth }), 12)
    const detailHeight = row.detail ? doc.font('body').fontSize(8.5).heightOfString(row.detail, { width: valueWidth }) + 1 : 0
    const height = valueHeight + detailHeight + CELL_Y * 2

    ensure(doc, height)

    const top = doc.y

    if (index % 2 === 0) doc.rect(MARGIN, top, CONTENT, height).fill(SURFACE)

    doc.fillColor(SLATE).font('strong').fontSize(9.5).text(row.label, MARGIN + CELL_X, top + CELL_Y)
    doc.fillColor(SLATE).font(valueFont).fontSize(9.5)
      .text(row.value, MARGIN + labelWidth + CELL_X, top + CELL_Y + (row.code ? 1 : 0), { width: valueWidth })

    if (row.detail) {
      doc.fillColor(MUTED).font('body').fontSize(8.5)
        .text(row.detail, MARGIN + labelWidth + CELL_X, top + CELL_Y + valueHeight + 1, { width: valueWidth })
    }

    doc.y = top + height
    hairline(doc, doc.y)
  })

  doc.y += 10
}

function hairline(doc: PDFKit.PDFDocument, y: number): void {
  doc.moveTo(MARGIN, y).lineTo(WIDTH - MARGIN, y).lineWidth(0.5).strokeColor(BORDER).stroke()
}

function ensure(doc: PDFKit.PDFDocument, height: number): boolean {
  if (doc.y + height <= FOOTER_TOP - 12) return false

  doc.addPage()
  doc.y = MARGIN

  return true
}
