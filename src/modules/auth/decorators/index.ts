import { SetMetadata, createParamDecorator } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import type { UserRole, IAccessTokenClaims } from '~/modules/auth/contracts/auth'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const ROLES_KEY = 'auth:roles'

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles)

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): IAccessTokenClaims => {
    return ctx.switchToHttp().getRequest<{ user: IAccessTokenClaims }>().user
  },
)
