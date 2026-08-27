import { Controller, Get, UseGuards } from '@nestjs/common'
import { AuthService } from '~/modules/auth/services/auth.service'
import { AuthGuard } from '~/modules/auth/guards/auth.guard'
import { CurrentUser } from '~/modules/auth/decorators'
import type { IAccessTokenClaims, IUserRaw } from '~/modules/auth/contracts/auth'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('users')
export class ProfileController {
  constructor(private readonly auth: AuthService) {}

  @Get('profile')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() claims: IAccessTokenClaims): Promise<IUserRaw> {
    const user = await this.auth.profile(claims.sub)

    return user.toPublic()
  }
}
