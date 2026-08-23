import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSamoRows, unescapeJs } from './samo.parser'

/**
 * Fixture: a real PRICESGROUP response, Tashkent → Turkey, captured
 * 2026-08-22. Exactly 100 rows, which is SAMO's page cap.
 *
 * The golden file is the reference tester's own parsed output, so this asserts
 * against a result a human already eyeballed in the browser.
 */
const FIXTURES = join(__dirname, '../fixtures')
const payload = readFileSync(join(FIXTURES, 'kompastour-tashkent-turkey-p1.txt'), 'utf8')
const golden = JSON.parse(
  readFileSync(join(FIXTURES, 'kompastour-tashkent-turkey-p1.expected.json'), 'utf8'),
) as Array<Record<string, string>>

describe('unescapeJs', () => {
  it('decodes \\uXXXX in one pass', () => {
    expect(unescapeJs('\\u041e\\u0441\\u0442')).toBe('Ост')
  })

  it('does not let \\\\ fake an escape', () => {
    expect(unescapeJs('a\\\\u0041b')).toBe('a\\u0041b')
  })
})

describe('parseSamoRows', () => {
  const rows = parseSamoRows(payload)

  it('finds every row on the page', () => {
    expect(rows).toHaveLength(100)
    expect(rows).toHaveLength(golden.length)
  })

  it('reads the structured data-* payload', () => {
    expect(rows[0]).toMatchObject({
      townfrom: '26',      // Tashkent
      state: '17',         // Turkey
      checkin: '20260822',
      nights: '7',
      hotel: '20086',
      statefrom: '14',
    })
  })

  it('separates the operator price from SAMO’s own conversion', () => {
    // Same row, two numbers: 1340.13 in currency 3, displayed as 1568 USD.
    // Trusting the displayed one would silently import their FX rate.
    expect(rows[0]).toMatchObject({
      priceSource: '1340.13',
      currencySource: '3',
      priceShown: '1568',
      currencyShown: 'USD',
    })
  })

  it('recognises a stop-sale', () => {
    expect(rows[0].flags).toContain('red_row')
    expect(rows[0].saleState).toBe('stop')
    // Cyrillic must survive the double escaping, or the reason is unreadable.
    expect(rows[0].stopReason).toMatch(/^Остановка продаж/)
  })

  it('decodes Cyrillic everywhere, not only in the reason', () => {
    expect(rows[0].district).toBe('Султанахмет')
    expect(rows[0].availabilityText).toBe('нет')
    expect(rows[0].tourName).toMatch(/Стамбул/)
  })

  it('keeps hotel identity: code, name, stars, slug', () => {
    expect(rows[0]).toMatchObject({
      hotelName: 'SANTA SOPHIA HOTEL 3*',
      stars: '3',
      hotelSlug: '/turkey/istanbul/santa_sophia_hotel/',
    })
  })

  it('agrees with the golden file on every row’s identity and price', () => {
    rows.forEach((row, i) => {
      expect(row.hotel, `row ${i} hotel`).toBe(golden[i].hotel)
      expect(row.priceSource, `row ${i} price`).toBe(golden[i].price_src)
      expect(row.checkin, `row ${i} checkin`).toBe(golden[i].checkin)
      expect(row.nights, `row ${i} nights`).toBe(golden[i].nights)
    })
  })

  it('returns nothing for an empty payload rather than throwing', () => {
    expect(parseSamoRows('')).toEqual([])
    expect(parseSamoRows('not a samo response')).toEqual([])
  })
})
