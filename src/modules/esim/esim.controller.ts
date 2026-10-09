import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common'
import { OptionalAuthGuard } from '~/modules/auth/guards/optional-auth.guard'
import { CurrentUser } from '~/modules/auth/decorators'
import { customerIdOf } from '~/modules/leads/lead.access'
import type { IAccessTokenClaims } from '~/modules/auth/contracts/auth'
import { EsimService } from './esim.service'
import type { ICheckoutInput } from './esim.rules'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('esim')
export class EsimController {
  constructor(private readonly esim: EsimService) {}

  @Get('countries')
  countries() {
    return this.esim.countries()
  }

  @Get('countries/:code')
  plans(@Param('code') code: string) {
    return this.esim.plans(code)
  }

  @Get('methods')
  methods() {
    return this.esim.methods()
  }

  @Post('purchases')
  @HttpCode(201)
  @UseGuards(OptionalAuthGuard)
  checkout(@Body() body: ICheckoutInput, @CurrentUser() claims?: IAccessTokenClaims) {
    return this.esim.checkout(body, customerIdOf(claims))
  }

  @Get('purchases/:token')
  purchase(@Param('token') token: string) {
    return this.esim.byToken(token)
  }

  @Post('sandbox/:token')
  @HttpCode(200)
  sandbox(@Param('token') token: string, @Body() body: { outcome?: string }) {
    return this.esim.sandboxPay(token, body?.outcome)
  }
}
