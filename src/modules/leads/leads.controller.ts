import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '~/modules/auth/guards/auth.guard'
import { OptionalAuthGuard } from '~/modules/auth/guards/optional-auth.guard'
import { RolesGuard } from '~/modules/auth/guards/roles.guard'
import { CurrentUser, Roles } from '~/modules/auth/decorators'
import { UserRole } from '~/modules/auth/contracts/auth'
import type { IAccessTokenClaims } from '~/modules/auth/contracts/auth'
import { LEAD_STATUSES, LeadSource } from './lead.entity'
import { LeadsService } from './leads.service'
import { customerIdOf, viewerOf } from './lead.access'
import type { ILeadInput, ILeadPatch } from './leads.service'
import { pageRequest } from '~/shared/helpers/pagination'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Post()
  @HttpCode(201)
  @UseGuards(OptionalAuthGuard)
  submit(@Body() body: ILeadInput, @CurrentUser() claims?: IAccessTokenClaims) {
    return this.leads.submit(body, LeadSource.Site, customerIdOf(claims), null, Boolean(claims))
  }
}

@Controller('cms/leads')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.Agent, UserRole.Manager, UserRole.Admin)
export class LeadsAdminController {
  constructor(private readonly leads: LeadsService) {}

  @Get('statuses')
  statuses() {
    return { items: LEAD_STATUSES }
  }

  @Get('staff')
  staff() {
    return this.leads.staff()
  }

  @Get()
  list(
    @CurrentUser() claims: IAccessTokenClaims,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('sort') sort?: string,
    @Query('dir') dir?: string,
    @Query('manager') manager?: string,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
    @Query('archived') archived?: string,
  ) {
    const query = { status, q, sort, dir, manager, archived }
    const viewer = viewerOf(claims)
    const request = pageRequest(page, perPage)

    return request ? this.leads.page(query, request, viewer) : this.leads.list(query, viewer)
  }

  @Get(':id')
  one(@Param('id') id: string, @CurrentUser() claims: IAccessTokenClaims) {
    return this.leads.one(id, viewerOf(claims))
  }

  @Get(':id/history')
  history(@Param('id') id: string, @CurrentUser() claims: IAccessTokenClaims) {
    return this.leads.history(id, viewerOf(claims))
  }

  @Post()
  @HttpCode(201)
  create(@Body() body: ILeadInput, @CurrentUser() claims: IAccessTokenClaims) {
    return this.leads.submit(body, LeadSource.Manual, null, claims.sub)
  }

  @Post(':id/take')
  @HttpCode(200)
  take(@Param('id') id: string, @CurrentUser() claims: IAccessTokenClaims) {
    return this.leads.take(id, viewerOf(claims))
  }

  @Post(':id/new-trip')
  @HttpCode(200)
  newTrip(@Param('id') id: string, @CurrentUser() claims: IAccessTokenClaims) {
    return this.leads.newTrip(id, viewerOf(claims))
  }

  @Patch(':id')
  patch(@Param('id') id: string, @Body() body: ILeadPatch, @CurrentUser() claims: IAccessTokenClaims) {
    return this.leads.patch(id, body, viewerOf(claims))
  }

  @Post(':id/archive')
  @HttpCode(200)
  archive(@Param('id') id: string, @CurrentUser() claims: IAccessTokenClaims) {
    return this.leads.archive(id, viewerOf(claims))
  }

  @Post(':id/restore')
  @HttpCode(200)
  restore(@Param('id') id: string, @CurrentUser() claims: IAccessTokenClaims) {
    return this.leads.restore(id, viewerOf(claims))
  }
}
