import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '~/modules/auth/guards/auth.guard'
import { RolesGuard } from '~/modules/auth/guards/roles.guard'
import { CurrentUser, Roles } from '~/modules/auth/decorators'
import { UserRole } from '~/modules/auth/contracts/auth'
import type { IAccessTokenClaims } from '~/modules/auth/contracts/auth'
import { viewerOf } from '~/modules/leads/lead.access'
import { TasksService } from './tasks.service'
import type { ITaskInput } from './tasks.rules'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('cms/tasks')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.Agent, UserRole.Manager, UserRole.Admin)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get('statuses')
  statuses() {
    return this.tasks.statuses()
  }

  @Get('summary')
  summary(@CurrentUser() claims: IAccessTokenClaims) {
    return this.tasks.summary(viewerOf(claims))
  }

  @Get()
  list(
    @CurrentUser() claims: IAccessTokenClaims,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('assignee') assignee?: string,
    @Query('mine') mine?: string,
    @Query('archived') archived?: string,
  ) {
    return this.tasks.list({ q, status, assignee, mine, archived }, viewerOf(claims))
  }

  @Get(':id')
  one(@Param('id') id: string, @CurrentUser() claims: IAccessTokenClaims) {
    return this.tasks.one(id, viewerOf(claims))
  }

  @Post()
  @HttpCode(201)
  create(@Body() body: ITaskInput, @CurrentUser() claims: IAccessTokenClaims) {
    return this.tasks.create(body, viewerOf(claims))
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: ITaskInput, @CurrentUser() claims: IAccessTokenClaims) {
    return this.tasks.update(id, body, viewerOf(claims))
  }

  @Post(':id/comments')
  @HttpCode(201)
  comment(@Param('id') id: string, @Body() body: { body?: string }, @CurrentUser() claims: IAccessTokenClaims) {
    return this.tasks.comment(id, body?.body, viewerOf(claims))
  }

  @Post(':id/archive')
  @HttpCode(200)
  archive(@Param('id') id: string, @CurrentUser() claims: IAccessTokenClaims) {
    return this.tasks.archive(id, viewerOf(claims))
  }

  @Post(':id/restore')
  @HttpCode(200)
  restore(@Param('id') id: string, @CurrentUser() claims: IAccessTokenClaims) {
    return this.tasks.restore(id, viewerOf(claims))
  }
}
