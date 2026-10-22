import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '~/modules/auth/guards/auth.guard'
import { RolesGuard } from '~/modules/auth/guards/roles.guard'
import { CurrentUser, Roles } from '~/modules/auth/decorators'
import { UserRole } from '~/modules/auth/contracts/auth'
import type { IAccessTokenClaims } from '~/modules/auth/contracts/auth'
import { viewerOf } from '~/modules/leads/lead.access'
import { NotesService } from './notes.service'
import type { INoteInput } from './notes.rules'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('cms/notes')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.Agent, UserRole.Manager, UserRole.Admin)
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get('pending')
  pending(@CurrentUser() claims: IAccessTokenClaims) {
    return this.notes.pending(viewerOf(claims))
  }

  @Get()
  list(
    @CurrentUser() claims: IAccessTokenClaims,
    @Query('kind') kind?: string,
    @Query('q') q?: string,
    @Query('archived') archived?: string,
  ) {
    return this.notes.list({ kind, q, archived }, viewerOf(claims))
  }

  @Get(':id')
  one(@Param('id') id: string, @CurrentUser() claims: IAccessTokenClaims) {
    return this.notes.one(id, viewerOf(claims))
  }

  @Post()
  @HttpCode(201)
  create(@Body() body: INoteInput, @CurrentUser() claims: IAccessTokenClaims) {
    return this.notes.create(body, viewerOf(claims))
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: INoteInput, @CurrentUser() claims: IAccessTokenClaims) {
    return this.notes.update(id, body, viewerOf(claims))
  }

  @Post(':id/ack')
  @HttpCode(200)
  acknowledge(@Param('id') id: string, @CurrentUser() claims: IAccessTokenClaims) {
    return this.notes.acknowledge(id, viewerOf(claims))
  }

  @Post(':id/archive')
  @HttpCode(200)
  archive(@Param('id') id: string, @CurrentUser() claims: IAccessTokenClaims) {
    return this.notes.archive(id, viewerOf(claims))
  }

  @Post(':id/restore')
  @HttpCode(200)
  restore(@Param('id') id: string, @CurrentUser() claims: IAccessTokenClaims) {
    return this.notes.restore(id, viewerOf(claims))
  }
}
