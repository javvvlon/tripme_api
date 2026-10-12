import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common'
import { AuthGuard } from '~/modules/auth/guards/auth.guard'
import { RolesGuard } from '~/modules/auth/guards/roles.guard'
import { CurrentUser, Roles } from '~/modules/auth/decorators'
import { UserRole } from '~/modules/auth/contracts/auth'
import type { IAccessTokenClaims } from '~/modules/auth/contracts/auth'
import { viewerOf } from '~/modules/leads/lead.access'
import { TeamService } from './team.service'
import type { IMemberInput } from './team.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('cms/team')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.Manager, UserRole.Admin)
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  members() {
    return this.team.members()
  }

  @Post()
  @HttpCode(201)
  create(@CurrentUser() claims: IAccessTokenClaims, @Body() body: IMemberInput) {
    return this.team.create(viewerOf(claims), body ?? {})
  }

  @Post(':id/password')
  @HttpCode(200)
  resetPassword(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() claims: IAccessTokenClaims) {
    return this.team.resetPassword(viewerOf(claims), id)
  }

  @Post(':id/archive')
  @HttpCode(200)
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() claims: IAccessTokenClaims, @Body() body: { hand_to?: string | null }) {
    return this.team.archive(viewerOf(claims), id, body?.hand_to ?? null)
  }

  @Post(':id/restore')
  @HttpCode(200)
  restore(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() claims: IAccessTokenClaims) {
    return this.team.restore(viewerOf(claims), id)
  }
}

@Controller('cms/me')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.Agent, UserRole.Manager, UserRole.Admin)
export class MyWorkController {
  constructor(private readonly team: TeamService) {}

  @Get('work')
  work(@CurrentUser() claims: IAccessTokenClaims) {
    return this.team.work(viewerOf(claims))
  }
}
