import { BadRequestException } from '@nestjs/common'
import type { ILoginData, ISignupData } from '~/modules/auth/contracts/auth'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const PHONE = /^\+?[\d\s\-()]{7,20}$/

const MIN_PASSWORD_LENGTH = 8

function str(body: Record<string, unknown>, key: string): string {
  const value = body[key]

  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`"${key}" is required`)
  }

  return value.trim()
}

export function parseLogin(body: Record<string, unknown>): ILoginData {
  return { email: str(body, 'email'), password: str(body, 'password') }
}

export function parseSignup(body: Record<string, unknown>): ISignupData {
  const email = str(body, 'email')
  const password = str(body, 'password')
  const phoneNumber = str(body, 'phone_number')

  if (!EMAIL.test(email)) throw new BadRequestException('That email address is not valid')
  if (!PHONE.test(phoneNumber)) throw new BadRequestException('That phone number is not valid')

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new BadRequestException(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  }

  if (body.consent !== true) {
    throw new BadRequestException('Consent to the processing of personal data is required')
  }

  return {
    consent: true,
    email,
    password,
    phoneNumber,
    firstName: str(body, 'first_name'),
    lastName: str(body, 'last_name'),
  }
}

export function parseEmail(body: Record<string, unknown>): string {
  const email = str(body, 'email')

  if (!EMAIL.test(email)) throw new BadRequestException('That email address is not valid')

  return email
}

export function parseVerification(body: Record<string, unknown>): { email: string, code: string } {
  return { email: parseEmail(body), code: str(body, 'code') }
}
