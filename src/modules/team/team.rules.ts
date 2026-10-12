import { randomInt } from 'node:crypto'
import { UserRole } from '~/modules/auth/contracts/auth'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const TEAM_ROLES: UserRole[] = [UserRole.Agent, UserRole.Manager, UserRole.Admin]

const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function canManage(actor: UserRole, target: UserRole): boolean {
  return actor === UserRole.Admin && TEAM_ROLES.includes(target)
}

export function temporaryPassword(pick: (max: number) => number = randomInt): string {
  const chars = Array.from({ length: 12 }, () => PASSWORD_ALPHABET[pick(PASSWORD_ALPHABET.length)])

  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8)].map(group => group.join('')).join('-')
}

export const isEmail = (value: string): boolean => EMAIL.test(value)
