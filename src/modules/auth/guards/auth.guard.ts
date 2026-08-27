import { Injectable, UnauthorizedException } from '@nestjs/common'
import type { CanActivate, ExecutionContext } from '@nestjs/common'
import { TokenService } from '~/modules/auth/services/token.service'
import type { IAccessTokenClaims } from '~/modules/auth/contracts/auth'
import type { Request } from 'express'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export function bearerToken(request: Request): string | null {
  const header = request.headers.authorization

  if (!header?.startsWith('Bearer ')) return null

  return header.slice('Bearer '.length).trim() || null
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: IAccessTokenClaims }>()
    const token = bearerToken(request)

    if (!token) throw new UnauthorizedException('Authentication required')

    const claims = await this.tokens.verifyAccess(token)

    if (!claims) throw new UnauthorizedException('Session expired')

    request.user = claims

    return true
  }
}
