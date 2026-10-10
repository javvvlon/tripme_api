import { describe, expect, it } from 'vitest'
import { hotelKey, hotelLabel, matchesHotel } from './hotel-key'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
describe('hotel identity across operators', () => {
  it('reads the same hotel the same way whatever the operator writes', () => {
    expect(hotelKey('REYDEL HOTEL 3*')).toBe(hotelKey('Reydel Hotel'))
    expect(hotelKey('Gaia Hotel Phu Quoc')).toBe(hotelKey('Gaia Hotel PhuQuoc'))
    expect(hotelKey('Asitane Life Hotel 4 *')).toBe(hotelKey('ASITANE LIFE'))
    expect(hotelKey('Rixos Premium Belek 5* (ex. Rixos Belek)')).toBe(hotelKey('Rixos Premium Belek'))
    expect(hotelKey('Café Royal & Spa 4* sup')).toBe(hotelKey('Cafe Royal and Spa'))
  })

  it('keeps different hotels apart', () => {
    expect(hotelKey('Rixos Premium Belek')).not.toBe(hotelKey('Rixos Premium Tekirova'))
    expect(hotelKey('Elan Hotel Taksim')).not.toBe(hotelKey('Elan Hotel Old City'))
  })

  it('shows a tidy name', () => {
    expect(hotelLabel('REYDEL HOTEL 3*')).toBe('Reydel Hotel')
    expect(hotelLabel('Cross Way Hotel 3*')).toBe('Cross Way Hotel')
    expect(hotelLabel('THE LOLA HOTEL')).toBe('The Lola Hotel')
    expect(hotelLabel('Rixos Park Belek (Ex. Rixos Belek) 5*')).toBe('Rixos Park Belek')
  })

  it('finds a hotel by any part of its name', () => {
    expect(matchesHotel('RIXOS PREMIUM BELEK 5*', 'rixos bel')).toBe(true)
    expect(matchesHotel('Rixos Premium Belek', 'premium')).toBe(true)
    expect(matchesHotel('Rixos Premium Belek', 'hilton')).toBe(false)
    expect(matchesHotel('Rixos Premium Belek', '   ')).toBe(false)
  })
})
