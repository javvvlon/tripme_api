import { existsSync } from 'node:fs'
import PDFDocument from 'pdfkit'

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
  note: string
  supplierOrderId: string
}

type IParty = IDocumentParty

const BRAND = '#F68634'
const INK = '#14171C'
const MUTED = '#6B7482'
const LINE = '#E3E6EA'
const SOFT = '#F2F4F7'

const MARGIN = 48
const WIDTH = 595.28
const CONTENT = WIDTH - MARGIN * 2

const fontFile = (weight: '400Regular' | '500Medium' | '700Bold'): string | null => {
  try {
    const entry = require.resolve('@expo-google-fonts/roboto/package.json')
    const path = entry.replace(/package\.json$/, `${weight}/Roboto_${weight}.ttf`)

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
  const regular = fontFile('400Regular')
  const medium = fontFile('500Medium')
  const bold = fontFile('700Bold')

  if (!regular || !bold) {
    return Promise.reject(new Error('The document font is missing — reinstall dependencies'))
  }

  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, info: {
    Title: `${TITLES[flavour]} ${data.number}`,
    Author: 'TripMe',
  } })

  doc.registerFont('body', regular)
  doc.registerFont('medium', medium ?? regular)
  doc.registerFont('bold', bold)

  const chunks: Buffer[] = []

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk as Buffer))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  header(doc, flavour, data)
  parties(doc, data)
  trip(doc, data)
  totals(doc, flavour, data)
  footer(doc, flavour)

  doc.end()

  return done
}

function header(doc: PDFKit.PDFDocument, flavour: DocumentFlavour, data: IDocumentData): void {
  doc.rect(0, 0, WIDTH, 6).fill(BRAND)

  doc.fillColor(INK).font('bold').fontSize(20).text('TripMe', MARGIN, 46)
  doc.fillColor(MUTED).font('body').fontSize(9).text('tourism company', MARGIN, 70)

  doc.fillColor(INK).font('bold').fontSize(17)
    .text(TITLES[flavour], MARGIN, 46, { width: CONTENT, align: 'right' })

  doc.fillColor(MUTED).font('body').fontSize(10)
    .text(`№ ${data.number}`, MARGIN, 70, { width: CONTENT, align: 'right' })
    .text(`от ${day(localDay(data.issuedOn))}`, MARGIN, 84, { width: CONTENT, align: 'right' })

  doc.moveTo(MARGIN, 108).lineTo(WIDTH - MARGIN, 108).strokeColor(LINE).stroke()

  doc.y = 126
}

function parties(doc: PDFKit.PDFDocument, data: IDocumentData): void {
  label(doc, 'Клиент')

  doc.fillColor(INK).font('medium').fontSize(12).text(data.client.name || '—', MARGIN, doc.y)

  if (data.client.phone) {
    doc.fillColor(MUTED).font('body').fontSize(10).text(data.client.phone, MARGIN, doc.y + 2)
  }

  doc.y += 18
}

function trip(doc: PDFKit.PDFDocument, data: IDocumentData): void {
  label(doc, 'Тур')

  const rows: Array<[string, string]> = [
    ['Направление', data.trip.country || '—'],
    ['Отель', data.trip.hotel || '—'],
    ['Туроператор', data.trip.supplier || '—'],
    ['Заезд — выезд', `${day(data.trip.checkIn)} — ${day(data.trip.returnDate)}`],
    ['Ночей', String(data.trip.nights || '—')],
    ['Туристы', travellers(data.trip)],
  ]

  if (data.trip.room) rows.push(['Номер', data.trip.room])
  if (data.trip.meal) rows.push(['Питание', data.trip.meal])
  if (data.supplierOrderId) rows.push(['Номер брони', data.supplierOrderId])

  table(doc, rows)
}

function travellers(from: IDocumentTrip): string {
  const parts = [`взрослых — ${from.adults || 0}`]

  if (from.children) parts.push(`детей — ${from.children}`)

  return parts.join(', ')
}

function totals(doc: PDFKit.PDFDocument, flavour: DocumentFlavour, data: IDocumentData): void {
  doc.y += 10

  const top = doc.y
  const height = 52

  doc.roundedRect(MARGIN, top, CONTENT, height, 8).fill(SOFT)

  doc.fillColor(MUTED).font('body').fontSize(10)
    .text(flavour === 'invoice' ? 'К оплате' : 'Стоимость тура', MARGIN + 16, top + 12)

  doc.fillColor(INK).font('bold').fontSize(18)
    .text(money(data.totals.amount, data.totals.currency), MARGIN + 16, top + 26)

  doc.y = top + height + 18

  if (!data.note) return

  label(doc, 'Примечание')
  doc.fillColor(INK).font('body').fontSize(10).text(data.note, MARGIN, doc.y, { width: CONTENT })
  doc.y += 8
}

function footer(doc: PDFKit.PDFDocument, flavour: DocumentFlavour): void {
  const note = flavour === 'offer'
    ? 'Предложение носит информационный характер. Стоимость и наличие мест подтверждаются на момент бронирования.'
    : 'Оплата подтверждает согласие с условиями бронирования. Реквизиты уточняйте у менеджера.'

  const y = 760

  doc.moveTo(MARGIN, y).lineTo(WIDTH - MARGIN, y).strokeColor(LINE).stroke()

  doc.fillColor(MUTED).font('body').fontSize(8.5)
    .text(note, MARGIN, y + 10, { width: CONTENT })
}

function label(doc: PDFKit.PDFDocument, text: string): void {
  doc.fillColor(MUTED).font('bold').fontSize(8)
    .text(text.toUpperCase(), MARGIN, doc.y, { characterSpacing: 0.6 })

  doc.y += 4
}

function table(doc: PDFKit.PDFDocument, rows: Array<[string, string]>): void {
  const labelWidth = 150
  const valueWidth = CONTENT - labelWidth

  for (const [name, value] of rows) {
    const top = doc.y + 6
    const height = Math.max(
      doc.font('body').fontSize(10).heightOfString(value, { width: valueWidth }),
      12,
    ) + 10

    doc.fillColor(MUTED).font('body').fontSize(10).text(name, MARGIN, top)
    doc.fillColor(INK).font('medium').fontSize(10)
      .text(value, MARGIN + labelWidth, top, { width: valueWidth })

    doc.y = top + height - 6
    doc.moveTo(MARGIN, doc.y).lineTo(WIDTH - MARGIN, doc.y).strokeColor(LINE).stroke()
  }

  doc.y += 6
}
