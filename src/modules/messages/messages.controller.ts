import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common'
import { AuthGuard } from '~/modules/auth/guards/auth.guard'
import { RolesGuard } from '~/modules/auth/guards/roles.guard'
import { CurrentUser, Roles } from '~/modules/auth/decorators'
import { UserRole } from '~/modules/auth/contracts/auth'
import { viewerOf } from '~/modules/leads/lead.access'
import { MessagesService } from './messages.service'
import type { IAccessTokenClaims } from '~/modules/auth/contracts/auth'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('account/messages')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.Client)
export class ClientMessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  thread(@CurrentUser() claims: IAccessTokenClaims) {
    return this.messages.clientThread(claims.sub)
  }

  @Get('unread')
  async unread(@CurrentUser() claims: IAccessTokenClaims) {
    return { unread: await this.messages.clientUnread(claims.sub) }
  }

  @Post()
  @HttpCode(201)
  send(@CurrentUser() claims: IAccessTokenClaims, @Body() body: { body?: string }) {
    return this.messages.postAsClient(claims.sub, body?.body)
  }
}

@Controller('cms')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.Agent, UserRole.Manager, UserRole.Admin)
export class StaffMessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('messages')
  inbox(@CurrentUser() claims: IAccessTokenClaims) {
    return this.messages.inbox(viewerOf(claims))
  }

  @Get('messages/unread')
  async unread(@CurrentUser() claims: IAccessTokenClaims) {
    return { unread: await this.messages.staffUnread(viewerOf(claims)) }
  }

  @Get('clients/:id/messages/unread')
  async clientUnread(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() claims: IAccessTokenClaims) {
    return { unread: await this.messages.staffUnreadFor(viewerOf(claims), id) }
  }

  @Get('clients/:id/messages')
  thread(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() claims: IAccessTokenClaims) {
    return this.messages.staffThread(viewerOf(claims), id)
  }

  @Post('clients/:id/messages')
  @HttpCode(201)
  send(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() claims: IAccessTokenClaims, @Body() body: { body?: string }) {
    return this.messages.postAsStaff(viewerOf(claims), id, body?.body)
  }
}
