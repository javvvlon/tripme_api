import { describe, expect, it } from 'vitest'
import { Availability } from '~/modules/search/contracts/search'
import { toAvailability } from './samo.map'
import type { SamoRow } from './samo.contracts'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const row = (changes: Partial<SamoRow>): SamoRow => ({ saleState: 'bron', availabilityCode: 'Y', flightCode: 'YY', ...changes } as SamoRow)

describe('SAMO availability', () => {
  it('sells a tour with hotel and flight seats both ways', () => {
    expect(toAvailability(row({}))).toBe(Availability.Available)
  })

  it('stops a tour without flight seats in either direction', () => {
    expect(toAvailability(row({ flightCode: 'YN' }))).toBe(Availability.Stopped)
    expect(toAvailability(row({ flightCode: 'NY' }))).toBe(Availability.Stopped)
  })

  it('keeps a stop-sale and a full hotel stopped', () => {
    expect(toAvailability(row({ saleState: 'stop' }))).toBe(Availability.Stopped)
    expect(toAvailability(row({ availabilityCode: 'N' }))).toBe(Availability.Stopped)
  })

  it('treats a hotel on request as on request', () => {
    expect(toAvailability(row({ availabilityCode: 'R' }))).toBe(Availability.OnRequest)
  })
})
