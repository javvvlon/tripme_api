import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, In, Repository } from 'typeorm'
import { UserEntity } from '~/modules/auth/entities'
import { UserRole } from '~/modules/auth/contracts/auth'
import { seesEveryone } from '~/modules/leads/lead.access'
import type { IViewer } from '~/modules/leads/lead.access'
import { MESSENGER } from '~/shared/messaging/messenger'
import type { IMessenger } from '~/shared/messaging/messenger'
import { messageText } from '~/shared/messaging/templates'
import { siteUrl } from '~/modules/esim/esim.links'
import { routeOf } from '~/modules/notifications/notification.rules'
import { ConversationEntity, MessageEntity } from './message.entities'
import { AuthorRole, messageBody, unreadFor } from './message.rules'

export interface IMessagePayload {
  id: string
  author: string
  author_name: string
  body: string
  created_at: string
}

export interface IThreadPayload {
  client: { id: string, name: string, email: string, phone: string }
  messages: IMessagePayload[]
  unread: number
}

export interface IInboxRow {
  client_id: string
  name: string
  email: string
  last_body: string
  last_author: string
  last_message_at: string | null
  unread: number
}

const THREAD_LIMIT = 300

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(ConversationEntity) private readonly conversations: Repository<ConversationEntity>,
    @InjectRepository(MessageEntity) private readonly messages: Repository<MessageEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly dataSource: DataSource,
    @Inject(MESSENGER) private readonly messenger: IMessenger,
  ) {}

  async clientThread(clientId: string): Promise<IThreadPayload> {
    const thread = await this.thread(clientId)

    await this.markRead(clientId, 'client')

    return thread
  }

  async staffThread(viewer: IViewer, clientId: string): Promise<IThreadPayload> {
    await this.assertStaffSees(viewer, clientId)

    const thread = await this.thread(clientId, 'staff')

    await this.markRead(clientId, 'staff')

    return thread
  }

  async postAsClient(clientId: string, raw: unknown): Promise<IMessagePayload> {
    const message = await this.post(clientId, AuthorRole.Client, clientId, messageBody(raw))

    return (await this.payloads([message]))[0]!
  }

  async postAsStaff(viewer: IViewer, clientId: string, raw: unknown): Promise<IMessagePayload> {
    await this.assertStaffSees(viewer, clientId)

    const message = await this.post(clientId, AuthorRole.Staff, viewer.id, messageBody(raw))

    await this.markRead(clientId, 'staff')
    void this.alertClient(clientId).catch(() => undefined)

    return (await this.payloads([message]))[0]!
  }

  async postSystem(clientId: string, body: string, orderId: string | null = null): Promise<void> {
    const client = await this.users.findOne({ where: { id: clientId } })

    if (!client || client.deletedAt || client.role !== UserRole.Client) return

    await this.post(clientId, AuthorRole.System, null, body.slice(0, 2000), orderId)
  }

  async clientUnread(clientId: string): Promise<number> {
    const conversation = await this.conversations.findOne({ where: { clientId } })

    if (!conversation) return 0

    const rows = await this.messages.find({ where: { clientId }, select: { authorRole: true, createdAt: true } })

    return unreadFor(rows, 'client', conversation.clientReadAt)
  }

  async inbox(viewer: IViewer): Promise<IInboxRow[]> {
    const builder = this.dataSource
      .createQueryBuilder()
      .select('c.client_id', 'client_id')
      .addSelect(`trim(u.first_name || ' ' || u.last_name)`, 'name')
      .addSelect('u.email', 'email')
      .addSelect('c.last_message_at', 'last_message_at')
      .addSelect('(select m.body from messages m where m.client_id = c.client_id order by m.created_at desc limit 1)', 'last_body')
      .addSelect('(select m.author_role from messages m where m.client_id = c.client_id order by m.created_at desc limit 1)', 'last_author')
      .addSelect(`(select count(*) from messages m where m.client_id = c.client_id and m.author_role = 'client' and (c.staff_read_at is null or m.created_at > c.staff_read_at))`, 'unread')
      .from(ConversationEntity, 'c')
      .innerJoin(UserEntity, 'u', 'u.id = c.client_id')
      .where('u.deleted_at is null')
      .andWhere('c.last_message_at is not null')
      .orderBy('c.last_message_at', 'DESC')
      .limit(200)

    if (!seesEveryone(viewer)) builder.andWhere(this.visibleSql(), { viewer: viewer.id })

    const rows = await builder.getRawMany<{ client_id: string, name: string, email: string, last_message_at: Date | null, last_body: string, last_author: string, unread: string }>()

    return rows.map(row => ({
      client_id: row.client_id,
      name: row.name || row.email,
      email: row.email,
      last_body: row.last_body ?? '',
      last_author: row.last_author ?? '',
      last_message_at: row.last_message_at ? new Date(row.last_message_at).toISOString() : null,
      unread: Number(row.unread),
    }))
  }

  async staffUnreadFor(viewer: IViewer, clientId: string): Promise<number> {
    await this.assertStaffSees(viewer, clientId)

    const conversation = await this.conversations.findOne({ where: { clientId } })

    if (!conversation) return 0

    const rows = await this.messages.find({ where: { clientId }, select: { authorRole: true, createdAt: true } })

    return unreadFor(rows, 'staff', conversation.staffReadAt)
  }

  async staffUnread(viewer: IViewer): Promise<number> {
    return (await this.inbox(viewer)).reduce((total, row) => total + row.unread, 0)
  }

  async forget(clientId: string): Promise<void> {
    await this.conversations.delete({ clientId })
  }

  private visibleSql(): string {
    return `(exists (select 1 from leads l where l.user_id = c.client_id and l.manager_id = :viewer)
      or exists (select 1 from orders o join leads l on l.id = o.lead_id where l.user_id = c.client_id and o.manager_id = :viewer))`
  }

  private async assertStaffSees(viewer: IViewer, clientId: string): Promise<void> {
    const client = await this.users.findOne({ where: { id: clientId } })

    if (!client || client.deletedAt || client.role !== UserRole.Client) throw new NotFoundException('Client not found')
    if (seesEveryone(viewer)) return

    const [row] = await this.dataSource.query(
      `select (exists (select 1 from leads l where l.user_id = $1 and l.manager_id = $2)
        or exists (select 1 from orders o join leads l on l.id = o.lead_id where l.user_id = $1 and o.manager_id = $2)) as visible`,
      [clientId, viewer.id],
    )

    if (!row?.visible) throw new ForbiddenException('This client belongs to another agent')
  }

  private async thread(clientId: string, reader: 'client' | 'staff' = 'client'): Promise<IThreadPayload> {
    const [client, conversation, rows] = await Promise.all([
      this.users.findOne({ where: { id: clientId } }),
      this.conversations.findOne({ where: { clientId } }),
      this.messages.find({ where: { clientId }, order: { createdAt: 'DESC' }, take: THREAD_LIMIT }),
    ])

    if (!client) throw new NotFoundException('Client not found')

    const ordered = rows.reverse()

    return {
      client: {
        id: client.id,
        name: [client.firstName, client.lastName].filter(Boolean).join(' '),
        email: client.email,
        phone: client.phoneNumber,
      },
      messages: await this.payloads(ordered),
      unread: unreadFor(ordered, reader, reader === 'client' ? conversation?.clientReadAt ?? null : conversation?.staffReadAt ?? null),
    }
  }

  private async post(clientId: string, role: AuthorRole, authorId: string | null, body: string, orderId: string | null = null): Promise<MessageEntity> {
    return this.dataSource.transaction(async (manager) => {
      const conversations = manager.getRepository(ConversationEntity)
      const now = new Date()

      await conversations.upsert({ clientId, lastMessageAt: now }, ['clientId'])

      if (role === AuthorRole.Client) await conversations.update({ clientId }, { clientReadAt: now })

      return manager.getRepository(MessageEntity).save({ clientId, authorId, authorRole: role, body, orderId, createdAt: now })
    })
  }

  private async markRead(clientId: string, reader: 'client' | 'staff'): Promise<void> {
    await this.conversations.update({ clientId }, reader === 'client' ? { clientReadAt: new Date() } : { staffReadAt: new Date() })
  }

  private async payloads(rows: MessageEntity[]): Promise<IMessagePayload[]> {
    const ids = [...new Set(rows.map(row => row.authorId).filter((id): id is string => Boolean(id)))]
    const authors = ids.length ? await this.users.find({ where: { id: In(ids) }, select: { id: true, firstName: true, lastName: true } }) : []
    const names = new Map(authors.map(user => [user.id, [user.firstName, user.lastName].filter(Boolean).join(' ')]))

    return rows.map(row => ({
      id: row.id,
      author: row.authorRole,
      author_name: row.authorRole === AuthorRole.System ? 'TripMe' : names.get(row.authorId ?? '') ?? '',
      body: row.body,
      created_at: row.createdAt.toISOString(),
    }))
  }

  private async alertClient(clientId: string): Promise<void> {
    const client = await this.users.findOne({ where: { id: clientId } })

    if (!client) return

    const route = routeOf({
      email: client.email,
      phone: client.phoneVerifiedAt ? client.phoneNumber : null,
      open: { email: this.messenger.available('email'), sms: this.messenger.available('sms') },
    })

    if (!route) return

    await this.messenger.send({ ...route, ...messageText('new_message', 'ru', { link: `${siteUrl()}/ru/account/messages` }) })
  }
}
