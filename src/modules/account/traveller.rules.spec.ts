import { describe, expect, it } from 'vitest'
import { travellerOf } from './traveller.rules'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
describe('saved travellers', () => {
  it('stores the names and passport the way the passport prints them', () => {
    expect(travellerOf({
      first_name: ' aziz ',
      last_name: 'Rakhimov',
      birth_date: '1990-04-12',
      gender: 'm',
      citizenship: 'uzb',
      passport_number: 'fa 1234567',
      passport_expires_at: '2031-01-01',
    })).toEqual({
      firstName: 'AZIZ',
      lastName: 'RAKHIMOV',
      birthDate: '1990-04-12',
      gender: 'M',
      citizenship: 'UZB',
      passportNumber: 'FA1234567',
      passportExpiresAt: '2031-01-01',
    })
  })

  it('refuses what a booking cannot use', () => {
    expect(() => travellerOf({ first_name: 'Азиз', last_name: 'Рахимов' })).toThrow('Latin')
    expect(() => travellerOf({ first_name: 'AZIZ' })).toThrow('first and a last name')
    expect(() => travellerOf({ first_name: 'A', last_name: 'B', birth_date: '12.04.1990' })).toThrow('2026-10-26')
    expect(() => travellerOf({ first_name: 'A', last_name: 'B', gender: 'X' })).toThrow('M or F')
  })

  it('keeps what an edit leaves out', () => {
    const current = travellerOf({ first_name: 'aziz', last_name: 'rakhimov', passport_number: 'FA1234567' })

    expect(travellerOf({ passport_expires_at: '2032-05-05' }, current)).toMatchObject({ firstName: 'AZIZ', passportNumber: 'FA1234567', passportExpiresAt: '2032-05-05' })
  })
})
