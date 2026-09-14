import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, UseGuards } from '@nestjs/common'
import { AuthGuard } from '~/modules/auth/guards/auth.guard'
import { RolesGuard } from '~/modules/auth/guards/roles.guard'
import { CurrentUser, Roles } from '~/modules/auth/decorators'
import { AGENT_ROLES, UserRole } from '~/modules/auth/contracts/auth'
import { PointsService } from './points.service'
import type { IAccessTokenClaims } from '~/modules/auth/contracts/auth'
import type { ITierInput } from './points.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('cms/points')
@UseGuards(AuthGuard, RolesGuard)
export class PointsController {
  constructor(private readonly points: PointsService) {}

  @Get()
  @Roles(...AGENT_ROLES)
  async overview() {
    const [tiers, rates] = await Promise.all([this.points.tiers(), this.points.rates()])

    return { tiers, rates }
  }

  @Put('rates')
  @Roles(UserRole.Manager, UserRole.Admin)
  rates(@Body() body: Record<string, unknown>) {
    return this.points.updateRates(body)
  }

  @Post('tiers')
  @Roles(UserRole.Manager, UserRole.Admin)
  createTier(@Body() body: ITierInput) {
    return this.points.createTier(body)
  }

  @Patch('tiers/:id')
  @Roles(UserRole.Manager, UserRole.Admin)
  patchTier(@Param('id') id: string, @Body() body: ITierInput) {
    return this.points.patchTier(id, body)
  }

  @Delete('tiers/:id')
  @Roles(UserRole.Manager, UserRole.Admin)
  @HttpCode(204)
  removeTier(@Param('id') id: string) {
    return this.points.removeTier(id)
  }

  @Get('customers/:userId')
  @Roles(...AGENT_ROLES)
  customer(@Param('userId') userId: string) {
    return this.points.customer(userId)
  }

  @Post('customers/:userId/adjust')
  @Roles(UserRole.Manager, UserRole.Admin)
  adjust(
    @Param('userId') userId: string,
    @Body() body: { delta?: number, note?: string },
    @CurrentUser() claims: IAccessTokenClaims,
  ) {
    return this.points.adjust(userId, Number(body.delta), body.note ?? '', claims.sub)
  }
}

@Controller('account/points')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.Client)
export class AccountPointsController {
  constructor(private readonly points: PointsService) {}

  @Get()
  async mine(@CurrentUser() claims: IAccessTokenClaims) {
    const [summary, history, tiers] = await Promise.all([
      this.points.summary(claims.sub),
      this.points.history(claims.sub),
      this.points.tiers(),
    ])

    return { summary, history, tiers }
  }
}
