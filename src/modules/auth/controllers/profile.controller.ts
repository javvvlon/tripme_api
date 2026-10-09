import { Body, Controller, Delete, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common'
import { AuthService } from '~/modules/auth/services/auth.service'
import { VerificationService } from '~/modules/auth/services/verification.service'
import { AuthGuard } from '~/modules/auth/guards/auth.guard'
import { CurrentUser } from '~/modules/auth/decorators'
import type { IAccessTokenClaims, IUserRaw } from '~/modules/auth/contracts/auth'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('users')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(
    private readonly auth: AuthService,
    private readonly verification: VerificationService,
  ) {}

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

  @Post('profile/phone/send-code')
  @HttpCode(204)
  async sendPhoneCode(@CurrentUser() claims: IAccessTokenClaims, @Body() body: { locale?: string }): Promise<void> {
    await this.verification.sendPhoneCode(claims.sub, typeof body?.locale === 'string' ? body.locale : 'ru')
  }

  @Post('profile/phone/verify')
  async verifyPhone(@CurrentUser() claims: IAccessTokenClaims, @Body() body: { code?: string }): Promise<IUserRaw> {
    await this.verification.verifyPhone(claims.sub, String(body?.code ?? ''))

    return (await this.auth.profile(claims.sub)).toPublic()
  }

  @Delete('profile')
  @HttpCode(204)
  async remove(@CurrentUser() claims: IAccessTokenClaims, @Body() body: { password?: string }): Promise<void> {
    await this.auth.deleteAccount(claims.sub, String(body?.password ?? ''))
  }
}
