import { Body, Controller, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common'
import { AuthService } from '~/modules/auth/services/auth.service'
import { AuthGuard } from '~/modules/auth/guards/auth.guard'
import { CurrentUser } from '~/modules/auth/decorators'
import type { IAccessTokenClaims, IUserRaw } from '~/modules/auth/contracts/auth'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('users')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(private readonly auth: AuthService) {}

  @Get('profile')
  async me(@CurrentUser() claims: IAccessTokenClaims): Promise<IUserRaw> {
    const user = await this.auth.profile(claims.sub)

    return user.toPublic()
  }

  @Patch('profile')
  async update(
    @CurrentUser() claims: IAccessTokenClaims,
    @Body() body: { first_name?: string, last_name?: string, phone_number?: string },
  ): Promise<IUserRaw> {
    const user = await this.auth.updateProfile(claims.sub, body)

    return user.toPublic()
  }

  @Post('profile/password')
  @HttpCode(204)
  async password(
    @CurrentUser() claims: IAccessTokenClaims,
    @Body() body: { current_password?: string, new_password?: string },
  ): Promise<void> {
    await this.auth.changePassword(claims.sub, body.current_password ?? '', body.new_password ?? '')
  }
}
