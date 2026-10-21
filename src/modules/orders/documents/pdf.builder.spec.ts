import { describe, expect, it } from 'vitest'
import { buildDocument } from './pdf.builder'
import type { IDocumentData } from './pdf.builder'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const data: IDocumentData = {
  number: '1025',
  issuedOn: new Date('2026-10-21T10:00:00Z'),
  client: { name: 'Азиз Рахимов', phone: '+998901234567' },
  trip: { country: 'Турция', hotel: 'Rixos Premium Belek 5*', supplier: 'Kompas Tour', checkIn: '2026-11-04', returnDate: '2026-11-11', nights: 7, adults: 2, children: 0, room: 'Deluxe', meal: 'UAI' },
  totals: { amount: 2400, currency: 'USD' },
  note: '',
  supplierOrderId: '',
}

describe('order PDF', () => {
  it('builds the offer with and without the eSIM block', async () => {
    const plain = await buildDocument('offer', data)
    const withEsim = await buildDocument('offer', { ...data, esim: { partner: 'eSIMo', code: 'TRIPME', discount_percent: 20 } })

    expect(plain.subarray(0, 5).toString()).toBe('%PDF-')
    expect(withEsim.subarray(0, 5).toString()).toBe('%PDF-')
    expect(withEsim.length).toBeGreaterThan(plain.length + 10_000)
  })
})
