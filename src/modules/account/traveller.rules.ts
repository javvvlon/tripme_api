import { BadRequestException } from '@nestjs/common'
import type { TravellerEntity } from './traveller.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface ITravellerInput {
  first_name?: string
  last_name?: string
  birth_date?: string | null
  gender?: string
  citizenship?: string
  passport_number?: string
  passport_expires_at?: string | null
}

export interface ITravellerPayload {
  id: string
  first_name: string
  last_name: string
  birth_date: string | null
  gender: string
  citizenship: string
  passport_number: string
  passport_expires_at: string | null
}

type TravellerFields = Pick<TravellerEntity, 'firstName' | 'lastName' | 'birthDate' | 'gender' | 'citizenship' | 'passportNumber' | 'passportExpiresAt'>

const LATIN = /^[A-Za-z][A-Za-z' -]*$/

const text = (value: unknown, limit: number): string | undefined =>
  typeof value === 'string' ? value.trim().slice(0, limit) : undefined

const day = (value: unknown, label: string): string | null | undefined => {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw new BadRequestException(`${label} must look like 2026-10-26`)

  return String(value)
}

export function travellerOf(input: ITravellerInput, current?: TravellerFields): TravellerFields {
  const firstName = text(input.first_name, 80)?.toUpperCase() ?? current?.firstName ?? ''
  const lastName = text(input.last_name, 80)?.toUpperCase() ?? current?.lastName ?? ''

  if (!firstName || !lastName) throw new BadRequestException('A traveller needs a first and a last name as in the passport')
  if (!LATIN.test(firstName) || !LATIN.test(lastName)) throw new BadRequestException('Names must be in Latin letters, as in the passport')

  const gender = text(input.gender, 1)?.toUpperCase() ?? current?.gender ?? ''

  if (gender && !['M', 'F'].includes(gender)) throw new BadRequestException('Gender is M or F')

  const birthDate = day(input.birth_date, 'The birth date')
  const passportExpiresAt = day(input.passport_expires_at, 'The passport expiry')

  return {
    firstName,
    lastName,
    birthDate: birthDate === undefined ? current?.birthDate ?? null : birthDate,
    gender,
    citizenship: text(input.citizenship, 3)?.toUpperCase() ?? current?.citizenship ?? '',
    passportNumber: text(input.passport_number, 20)?.toUpperCase().replace(/\s/g, '') ?? current?.passportNumber ?? '',
    passportExpiresAt: passportExpiresAt === undefined ? current?.passportExpiresAt ?? null : passportExpiresAt,
  }
}

export const travellerPayload = (row: TravellerEntity): ITravellerPayload => ({
  id: row.id,
  first_name: row.firstName,
  last_name: row.lastName,
  birth_date: row.birthDate,
  gender: row.gender,
  citizenship: row.citizenship,
  passport_number: row.passportNumber,
  passport_expires_at: row.passportExpiresAt,
})
