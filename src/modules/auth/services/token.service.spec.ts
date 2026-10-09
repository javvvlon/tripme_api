import { describe, expect, it } from 'vitest'
import { JwtService } from '@nestjs/jwt'
import { TokenService } from './token.service'
import { UserRole } from '~/modules/auth/contracts/auth'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const jwt = new JwtService({ secret: 'x'.repeat(40), signOptions: { algorithm: 'HS256' } })
const tokens = new TokenService(jwt, {} as never)
const claims = { sub: 'u1', email: 'aziz@example.uz', role: UserRole.Client }

describe('stream tickets', () => {
  it('opens a stream for the person it was issued to', async () => {
    const ticket = await tokens.issueStreamTicket(claims)

    expect(await tokens.verifyStreamTicket(ticket)).toEqual(claims)
  })

  it('never works as a sign-in token, and a sign-in token never opens a stream', async () => {
    const ticket = await tokens.issueStreamTicket(claims)
    const access = await jwt.signAsync(claims, { expiresIn: '15m' })

    expect(await tokens.verifyAccess(ticket)).toBeNull()
    expect(await tokens.verifyStreamTicket(access)).toBeNull()
    expect(await tokens.verifyAccess(access)).toMatchObject(claims)
  })

  it('refuses a forged ticket', async () => {
    const forged = await new JwtService({ secret: 'y'.repeat(40) }).signAsync({ ...claims, typ: 'stream' })

    expect(await tokens.verifyStreamTicket(forged)).toBeNull()
  })
})
