import { parse as parseHtml } from 'node-html-parser'
import type { SamoRow } from './samo.contracts'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export function unescapeJs(input: string): string {
  return input.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, (_, group: string) => {
    if (group[0] === 'u' || group[0] === 'x') {
      return String.fromCharCode(parseInt(group.slice(1), 16))
    }
    if (group === 'n' || group === 'r' || group === 't') return ' '
    return group
  })
}

function decodeAttribute(value: string): string {
  return /\\u[0-9a-fA-F]{4}/.test(value) ? unescapeJs(value) : value
}

const clean = (value: string | undefined | null): string => (value ?? '').replace(/\s+/g, ' ').trim()

export function parseSamoRows(payload: string): SamoRow[] {
  if (!payload.trim()) return []

  const text = unescapeJs(payload)

  const first = text.indexOf('<tr')
  const last = text.lastIndexOf('</tr>')
  if (first === -1 || last === -1) return []

  const root = parseHtml(`<table><tbody>${text.slice(first, last + 5)}</tbody></table>`)

  return root.querySelectorAll('tr').map((tr): SamoRow => {
    const attr = (name: string) => decodeAttribute(tr.getAttribute(name) ?? '')

    const priceSpan = tr.querySelector('td.td_price span')
    const priceClass = priceSpan?.getAttribute('class') ?? ''

    const availability = tr.querySelectorAll('span.hotel_availability')
    const availabilityCode = [
      ...new Set(
        availability
          .flatMap(node => (node.getAttribute('class') ?? '').split(/\s+/))
          .filter(cls => cls.startsWith('hotel_availability_'))
          .map(cls => cls.slice('hotel_availability_'.length)),
      ),
    ].join('')

    const flight = tr.querySelectorAll('[class*="fr_place"]')
    const flightCode = flight
      .map(node => (node.getAttribute('class') ?? '').split(/\s+/).find(cls => cls.length === 1) ?? '?')
      .join('')

    const link = tr.querySelector('td.link-hotel a')
    const linkCell = tr.querySelector('td.link-hotel')
    const linkText = clean(linkCell?.textContent)
    const hotelUrl = decodeAttribute(link?.getAttribute('href') ?? '')
    const slugMatch = /redirect_url=([^&"]+)/.exec(hotelUrl)
    const districtMatch = /\(([^)]+)\)\s*$/.exec(linkText)

    const hotelName = link
      ? clean(link.textContent)
      : linkText.replace(/\s*\([^)]*\)\s*$/, '').trim()

    const cells = tr.querySelectorAll('td')

    return {
      townfrom: attr('data-townfrom'),
      state: attr('data-state'),
      checkin: attr('data-checkin'),
      nights: attr('data-nights'),
      hotel: attr('data-hotel'),
      statefrom: attr('data-statefrom'),
      tour: attr('data-tour'),
      meal: attr('data-meal'),
      room: attr('data-room'),
      htplace: attr('data-htplace'),

      hotelName,
      hotelUrl,
      hotelSlug: slugMatch?.[1] ? decodeURIComponent(slugMatch[1]) : '',
      district: districtMatch?.[1] ? decodeAttribute(districtMatch[1]) : '',
      stars: /(\d)\*/.exec(hotelName)?.[1] ?? '',

      priceSource: priceSpan?.getAttribute('data-cat-price') ?? '',
      currencySource: priceSpan?.getAttribute('data-cat-currency') ?? '',
      priceShown: priceSpan?.getAttribute('data-converted-price-number') ?? '',
      currencyShown: priceSpan?.getAttribute('data-currency_title') ?? '',

      saleState: /\bstop\b/.test(priceClass) ? 'stop' : /\bbron\b/.test(priceClass) ? 'bron' : '',
      stopReason: clean(decodeAttribute(priceSpan?.getAttribute('title') ?? '')),
      availabilityCode,
      availabilityText: clean(decodeAttribute(availability[0]?.getAttribute('title') ?? '')),
      flightCode,
      flightText: clean(decodeAttribute(flight[0]?.getAttribute('title') ?? '')),

      tourName: clean(tr.querySelector('td.tour')?.textContent),
      fare: clean(tr.querySelector('td.type_price')?.textContent),
      mealText: clean(cells[6]?.textContent),
      roomText: clean(cells[7]?.textContent),

      flags: clean(tr.getAttribute('class')),
    }
  })
}
