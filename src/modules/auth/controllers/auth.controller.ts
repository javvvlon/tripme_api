import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common'
import { AuthService } from '~/modules/auth/services/auth.service'
import { VerificationService } from '~/modules/auth/services/verification.service'
import { TokenService } from '~/modules/auth/services/token.service'
import { SessionRepository } from '~/modules/auth/repositories/session.repository'
import { bearerToken } from '~/modules/auth/guards/auth.guard'
import { parseEmail, parseLogin, parseSignup, parseVerification } from '~/modules/auth/validation/payloads'
import type { ITokenPair } from '~/modules/auth/contracts/auth'
import type { IRequestContext } from '~/modules/auth/services/auth.service'
import type { Request } from 'express'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('users/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly verification: VerificationService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionRepository,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: Record<string, unknown>, @Req() request: Request): Promise<ITokenPair> {
    return this.auth.login(parseLogin(body), context(request))
  }

  @Post('signup')
  @HttpCode(200)
  async signup(@Body() body: Record<string, unknown>, @Req() request: Request): Promise<ITokenPair> {
    return this.auth.signup(parseSignup(body), context(request))
  }

  @Post('login/refresh')
  @HttpCode(200)
  async refresh(@Req() request: Request): Promise<ITokenPair> {
    const token = bearerToken(request) ?? ''

    return this.auth.refresh(token, context(request))
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body() body: Record<string, unknown>, @Req() request: Request): Promise<void> {
    const fromBody = typeof body?.refresh_token === 'string' ? body.refresh_token : null
    const header = bearerToken(request)

    if (fromBody) {
      await this.auth.logout(fromBody)
      return
    }

    if (!header) return

    const claims = await this.tokens.verifyAccess(header)

    if (claims) await this.sessions.revokeAllForUser(claims.sub)
    else await this.auth.logout(header)
  }

  @Get('capabilities')
  capabilities() {
    return this.verification.capabilities()
  }

  @Post('send-verification-message')
  @HttpCode(204)
  async sendVerification(@Body() body: Record<string, unknown>): Promise<void> {
    await this.verification.send(parseEmail(body), localeOf(body))
  }

  @Post('password/forgot')
  @HttpCode(204)
  async forgot(@Body() body: Record<string, unknown>): Promise<void> {
    await this.verification.sendReset(parseEmail(body), localeOf(body))
  }

  @Post('password/reset')
  @HttpCode(200)
  async reset(@Body() body: Record<string, unknown>, @Req() request: Request): Promise<ITokenPair> {
    const email = parseEmail(body)
    const code = typeof body?.code === 'string' ? body.code : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    return this.verification.resetPassword(email, code, password, context(request))
  }

  @Post('verify')
  @HttpCode(200)
  async verify(@Body() body: Record<string, unknown>, @Req() request: Request): Promise<ITokenPair> {
    const { email, code } = parseVerification(body)

    return this.verification.verify(email, code, context(request))
  }
}

const localeOf = (body: Record<string, unknown>): string =>
  typeof body?.locale === 'string' ? body.locale.slice(0, 5) : 'ru'

function context(request: Request): IRequestContext {
  return {
    userAgent: request.headers['user-agent']?.slice(0, 300),
    ip: request.ip,
  }
}
