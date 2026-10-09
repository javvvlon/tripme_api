import { Controller, HttpCode, Post, Query, Sse, UnauthorizedException, UseGuards } from '@nestjs/common'
import { filter, from, interval, map, merge, mergeMap, of } from 'rxjs'
import type { Observable } from 'rxjs'
import { AuthGuard } from '~/modules/auth/guards/auth.guard'
import { CurrentUser } from '~/modules/auth/decorators'
import { TokenService } from '~/modules/auth/services/token.service'
import { UserRole } from '~/modules/auth/contracts/auth'
import { seesEveryone, viewerOf } from '~/modules/leads/lead.access'
import { MessagesHub } from './messages.hub'
import { MessagesService } from './messages.service'
import type { HubEvent } from './messages.hub'
import type { IAccessTokenClaims } from '~/modules/auth/contracts/auth'

const HEARTBEAT_MS = 25000

const STAFF_ROLES: string[] = [UserRole.Agent, UserRole.Manager, UserRole.Admin]

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('messages')
export class MessagesStreamController {
  constructor(
    private readonly tokens: TokenService,
    private readonly hub: MessagesHub,
    private readonly messages: MessagesService,
  ) {}

  @Post('stream-ticket')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async ticket(@CurrentUser() claims: IAccessTokenClaims) {
    return { ticket: await this.tokens.issueStreamTicket(claims) }
  }

  @Sse('stream')
  async stream(@Query('ticket') ticket?: string): Promise<Observable<MessageEvent>> {
    const claims = ticket ? await this.tokens.verifyStreamTicket(ticket) : null

    if (!claims) throw new UnauthorizedException('The stream ticket is invalid or has expired')

    const relevant = this.relevance(claims)

    const events = this.hub.events.pipe(
      mergeMap(event => from(relevant(event)).pipe(filter(Boolean), map(() => event))),
      map(event => ({ data: event }) as MessageEvent),
    )

    const heartbeat = interval(HEARTBEAT_MS).pipe(map(() => ({ data: { type: 'ping' } }) as MessageEvent))

    return merge(of({ data: { type: 'ready' } } as MessageEvent), events, heartbeat)
  }

  private relevance(claims: IAccessTokenClaims): (event: HubEvent) => Promise<boolean> {
    if (claims.role === UserRole.Client) {
      return async event => event.clientId === claims.sub && !(event.type === 'read' && event.side === 'staff')
    }

    if (!STAFF_ROLES.includes(claims.role)) return async () => false

    const viewer = viewerOf(claims)

    if (seesEveryone(viewer)) return async event => !(event.type === 'read' && event.side === 'client')

    const known = new Map<string, Promise<boolean>>()

    return async (event) => {
      if (event.type === 'read' && event.side === 'client') return false

      if (!known.has(event.clientId)) known.set(event.clientId, this.messages.canStaffSee(viewer, event.clientId))

      return known.get(event.clientId)!
    }
  }
}
