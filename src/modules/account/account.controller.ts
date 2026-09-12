import { Controller, Get, Param, UseGuards } from '@nestjs/common'
import { AuthGuard } from '~/modules/auth/guards/auth.guard'
import { RolesGuard } from '~/modules/auth/guards/roles.guard'
import { CurrentUser, Roles } from '~/modules/auth/decorators'
import { UserRole } from '~/modules/auth/contracts/auth'
import { AccountService } from './account.service'
import type { IAccessTokenClaims } from '~/modules/auth/contracts/auth'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('account')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.Client)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('orders')
  orders(@CurrentUser() claims: IAccessTokenClaims) {
    return this.account.list(claims.sub)
  }

  @Get('orders/:id')
  order(@CurrentUser() claims: IAccessTokenClaims, @Param('id') id: string) {
    return this.account.one(claims.sub, id)
  }
}
