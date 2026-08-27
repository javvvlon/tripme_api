import { ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { CanActivate, ExecutionContext } from '@nestjs/common'
import { ROLES_KEY } from '~/modules/auth/decorators'
import type { IAccessTokenClaims, UserRole } from '~/modules/auth/contracts/auth'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!required?.length) return true

    const { user } = context.switchToHttp().getRequest<{ user?: IAccessTokenClaims }>()

    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('Your account does not have access to this')
    }

    return true
  }
}
