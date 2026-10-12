import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, In, IsNull, Repository } from 'typeorm'
import { UserEntity } from '~/modules/auth/entities'
import { UserRole } from '~/modules/auth/contracts/auth'
import { UserRepository, normaliseEmail } from '~/modules/auth/repositories/user.repository'
import { SessionRepository } from '~/modules/auth/repositories/session.repository'
import { PasswordService } from '~/modules/auth/services/password.service'
import { LeadsService } from '~/modules/leads/leads.service'
import { QUEUE_STATUSES } from '~/modules/leads/lead.access'
import type { IViewer } from '~/modules/leads/lead.access'
import { MessagesService } from '~/modules/messages/messages.service'
import { TEAM_ROLES, canManage, isEmail, temporaryPassword } from './team.rules'

export interface ITeamMember {
  uuid: string
  email: string
  first_name: string
  last_name: string
  phone: string
  role: UserRole
  archived_at: string | null
  last_seen_at: string | null
  open_leads: number
  open_orders: number
  created_at: string
}

export interface IMemberInput {
  email?: string
  first_name?: string
  last_name?: string
  phone?: string
  role?: string
}

export interface IMyWork {
  free_leads: number
  unanswered_leads: number
  draft_orders: number
  requested_orders: number
  unread_messages: number
}

const text = (value: unknown, limit: number): string => (typeof value === 'string' ? value.trim().slice(0, limit) : '')

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly accounts: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly passwords: PasswordService,
    private readonly leads: LeadsService,
    private readonly messages: MessagesService,
    private readonly dataSource: DataSource,
  ) {}

  async members(): Promise<ITeamMember[]> {
    const rows = await this.users.find({ where: { role: In(TEAM_ROLES), deletedAt: IsNull() }, order: { firstName: 'ASC', lastName: 'ASC' } })

    return this.present(rows)
  }

  async create(actor: IViewer, input: IMemberInput): Promise<{ member: ITeamMember, password: string }> {
    const email = normaliseEmail(text(input.email, 200))
    const role = input.role as UserRole
    const firstName = text(input.first_name, 120)

    if (!isEmail(email)) throw new BadRequestException('Enter a valid email')
    if (!firstName) throw new BadRequestException('A first name is required')
    if (!canManage(actor.role, role)) throw new ForbiddenException('You cannot create this role')
    if (await this.accounts.emailExists(email)) throw new ConflictException('That email is already registered')

    const password = temporaryPassword()
    const user = await this.accounts.create({
      email,
      passwordHash: await this.passwords.hash(password),
      firstName,
      lastName: text(input.last_name, 120),
      phoneNumber: text(input.phone, 40),
      role,
    })

    await this.accounts.markVerified(user.get('id'))

    return { member: await this.one(user.get('id')), password }
  }

  async resetPassword(actor: IViewer, id: string): Promise<{ password: string }> {
    const target = await this.managed(actor, id)

    if (target.archivedAt) throw new ConflictException('Restore the account first')

    const password = temporaryPassword()

    await this.accounts.setPassword(id, await this.passwords.hash(password))
    await this.sessions.revokeAllForUser(id)

    return { password }
  }

  async archive(actor: IViewer, id: string, handTo: string | null): Promise<ITeamMember> {
    const target = await this.managed(actor, id)

    if (target.archivedAt) return this.one(id)

    if (handTo) {
      if (handTo === id) throw new BadRequestException('Pick someone else to take over')

      await this.leads.assertStaff(handTo)
    }

    await this.leads.handOver(id, handTo || null, actor.id)
    await this.users.update({ id }, { archivedAt: new Date() })
    await this.sessions.revokeAllForUser(id)

    return this.one(id)
  }

  async restore(actor: IViewer, id: string): Promise<ITeamMember> {
    await this.managed(actor, id)
    await this.users.update({ id }, { archivedAt: null })

    return this.one(id)
  }

  async work(viewer: IViewer): Promise<IMyWork> {
    const [counts] = await this.dataSource.query(
      `select
         (select count(*) from leads where archived_at is null and manager_id is null and status = any($2)) as free_leads,
         (select count(*) from leads where archived_at is null and manager_id = $1 and status = 'new') as unanswered_leads,
         (select count(*) from orders o join leads l on l.id = o.lead_id
           where o.archived_at is null and l.archived_at is null and o.manager_id = $1 and o.status = 'draft') as draft_orders,
         (select count(*) from orders o join leads l on l.id = o.lead_id
           where o.archived_at is null and l.archived_at is null and o.manager_id = $1 and o.status = 'requested') as requested_orders`,
      [viewer.id, QUEUE_STATUSES],
    )

    return {
      free_leads: Number(counts.free_leads),
      unanswered_leads: Number(counts.unanswered_leads),
      draft_orders: Number(counts.draft_orders),
      requested_orders: Number(counts.requested_orders),
      unread_messages: await this.messages.staffUnread(viewer),
    }
  }

  private async managed(actor: IViewer, id: string): Promise<UserEntity> {
    const target = await this.users.findOne({ where: { id, role: In(TEAM_ROLES), deletedAt: IsNull() } })

    if (!target) throw new NotFoundException('Team member not found')
    if (target.id === actor.id) throw new ForbiddenException('Use your own profile for your account')
    if (!canManage(actor.role, target.role)) throw new ForbiddenException('You cannot manage this account')

    return target
  }

  private async one(id: string): Promise<ITeamMember> {
    const row = await this.users.findOneOrFail({ where: { id } })

    return (await this.present([row]))[0]!
  }

  private async present(rows: UserEntity[]): Promise<ITeamMember[]> {
    const ids = rows.map(row => row.id)

    if (!ids.length) return []

    const [leads, orders, seen] = await Promise.all([
      this.dataSource.query(
        `select manager_id as id, count(*)::int as n from leads
         where archived_at is null and manager_id = any($1) and status = any($2) group by manager_id`,
        [ids, QUEUE_STATUSES],
      ),
      this.dataSource.query(
        `select manager_id as id, count(*)::int as n from orders
         where archived_at is null and manager_id = any($1) and status not in ('completed', 'cancelled') group by manager_id`,
        [ids],
      ),
      this.dataSource.query(`select user_id as id, max(created_at) as at from sessions where user_id = any($1) group by user_id`, [ids]),
    ]) as [Array<{ id: string, n: number }>, Array<{ id: string, n: number }>, Array<{ id: string, at: Date }>]

    const count = (list: Array<{ id: string, n: number }>) => new Map(list.map(entry => [entry.id, Number(entry.n)]))
    const leadCounts = count(leads)
    const orderCounts = count(orders)
    const lastSeen = new Map(seen.map(entry => [entry.id, new Date(entry.at).toISOString()]))

    return rows.map(row => ({
      uuid: row.id,
      email: row.email,
      first_name: row.firstName,
      last_name: row.lastName,
      phone: row.phoneNumber,
      role: row.role,
      archived_at: row.archivedAt ? row.archivedAt.toISOString() : null,
      last_seen_at: lastSeen.get(row.id) ?? null,
      open_leads: leadCounts.get(row.id) ?? 0,
      open_orders: orderCounts.get(row.id) ?? 0,
      created_at: row.createdAt.toISOString(),
    }))
  }
}
