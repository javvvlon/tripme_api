import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '~/modules/auth/guards/auth.guard'
import { OptionalAuthGuard } from '~/modules/auth/guards/optional-auth.guard'
import { RolesGuard } from '~/modules/auth/guards/roles.guard'
import { CurrentUser, Roles } from '~/modules/auth/decorators'
import { UserRole } from '~/modules/auth/contracts/auth'
import type { IAccessTokenClaims } from '~/modules/auth/contracts/auth'
import { LEAD_STATUSES, LeadSource } from './lead.entity'
import { LeadsService } from './leads.service'
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
    return this.leads.submit(body, LeadSource.Site, claims?.sub ?? null)
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

  @Get()
  list(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('sort') sort?: string,
    @Query('dir') dir?: string,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
  ) {
    const request = pageRequest(page, perPage)

    return request ? this.leads.page({ status, q, sort, dir }, request) : this.leads.list({ status, q, sort, dir })
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.leads.one(id)
  }

  @Post()
  @HttpCode(201)
  create(@Body() body: ILeadInput) {
    return this.leads.submit(body, LeadSource.Manual)
  }

  @Patch(':id')
  patch(@Param('id') id: string, @Body() body: ILeadPatch) {
    return this.leads.patch(id, body)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.leads.remove(id)
  }
}
