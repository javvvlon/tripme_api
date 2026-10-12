import { describe, expect, it } from 'vitest'
import { UserRole } from '~/modules/auth/contracts/auth'
import { canManage, isEmail, temporaryPassword } from './team.rules'

describe('canManage', () => {
  it('lets an admin manage every staff role', () => {
    expect([UserRole.Agent, UserRole.Manager, UserRole.Admin].every(role => canManage(UserRole.Admin, role))).toBe(true)
  })

  it('gives managers, agents and clients nothing', () => {
    expect(canManage(UserRole.Manager, UserRole.Agent)).toBe(false)
    expect(canManage(UserRole.Manager, UserRole.Manager)).toBe(false)
    expect(canManage(UserRole.Agent, UserRole.Agent)).toBe(false)
    expect(canManage(UserRole.Admin, UserRole.Client)).toBe(false)
  })
})

describe('temporaryPassword', () => {
  it('reads in three groups without lookalike characters', () => {
    const password = temporaryPassword()

    expect(password).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/)
    expect(password).not.toMatch(/[01lIoO]/)
  })
})

describe('isEmail', () => {
  it('needs a name, an at sign and a domain', () => {
    expect(isEmail('agent@tripme.uz')).toBe(true)
    expect(isEmail('agent@tripme')).toBe(false)
  })
})
