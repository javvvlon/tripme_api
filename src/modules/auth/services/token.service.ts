import { randomBytes } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { JwtSignOptions } from '@nestjs/jwt'
import { SessionRepository } from '~/modules/auth/repositories/session.repository'
import type { IAccessTokenClaims, ITokenPair } from '~/modules/auth/contracts/auth'
import type { User } from '~/modules/auth/models/User'

const STREAM_TICKET = 'stream'

const STREAM_TICKET_TTL = '60s'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class TokenService {
  private readonly accessTtl = (process.env.JWT_ACCESS_TTL ?? '15m') as JwtSignOptions['expiresIn']
  private readonly refreshTtlDays = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30)

  constructor(
    private readonly jwt: JwtService,
    private readonly sessions: SessionRepository,
  ) {}

  async issue(user: User, context: { userAgent?: string, ip?: string } = {}): Promise<ITokenPair> {
    const claims: IAccessTokenClaims = {
      sub: user.get('id'),
      email: user.get('email'),
      role: user.get('role'),
    }

    const accessToken = await this.jwt.signAsync(claims, { expiresIn: this.accessTtl })

    const refreshToken = randomBytes(32).toString('base64url')

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + this.refreshTtlDays)

    await this.sessions.create(user.get('id'), refreshToken, expiresAt, context)

    return { access_token: accessToken, refresh_token: refreshToken }
  }

  async verifyAccess(token: string): Promise<IAccessTokenClaims | null> {
    try {
      const claims = await this.jwt.verifyAsync<IAccessTokenClaims & { typ?: string }>(token)

      return claims.typ ? null : claims
    }
    catch {
      return null
    }
  }

  async issueStreamTicket(claims: IAccessTokenClaims): Promise<string> {
    return this.jwt.signAsync({ sub: claims.sub, email: claims.email, role: claims.role, typ: STREAM_TICKET }, { expiresIn: STREAM_TICKET_TTL })
  }

  async verifyStreamTicket(ticket: string): Promise<IAccessTokenClaims | null> {
    try {
      const claims = await this.jwt.verifyAsync<IAccessTokenClaims & { typ?: string }>(ticket)

      return claims.typ === STREAM_TICKET ? { sub: claims.sub, email: claims.email, role: claims.role } : null
    }
    catch {
      return null
    }
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.sessions.revoke(refreshToken)
  }
}
