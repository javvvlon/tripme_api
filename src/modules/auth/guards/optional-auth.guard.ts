import { Injectable } from '@nestjs/common'
import type { CanActivate, ExecutionContext } from '@nestjs/common'
import { TokenService } from '~/modules/auth/services/token.service'
import { bearerToken } from './auth.guard'
import type { IAccessTokenClaims } from '~/modules/auth/contracts/auth'
import type { Request } from 'express'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: IAccessTokenClaims }>()
    const token = bearerToken(request)

    if (token) {
      const claims = await this.tokens.verifyAccess(token)

      if (claims) request.user = claims
    }

    return true
  }
}
