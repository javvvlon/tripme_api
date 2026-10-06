import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Brackets, In, Repository } from 'typeorm'
import type { EntityManager } from 'typeorm'
import { LEAD_PREFIX, numberFromReference, reference } from '~/shared/helpers/reference'
import { UserEntity } from '~/modules/auth/entities'
import { LEAD_STATUSES, LEAD_TRANSITIONS, LeadEntity, LeadSource, LeadStatus } from './lead.entity'
import { LeadEventEntity, LeadEventKind } from './lead-event.entity'
import { QUEUE_STATUSES, STAFF_ROLES, canSeeLead, seesEveryone } from './lead.access'
import type { IViewer } from './lead.access'

export interface ILeadTripInput {
  hotel_name?: string
  supplier_name?: string
  check_in?: string
  nights?: number
  adults?: number
  children?: number
  price_amount?: number
  price_currency?: string
  route_from?: string
  route_to?: string
  [key: string]: unknown
}

export interface ILeadInput {
  channel?: string
  destination?: string
  planned_dates?: string
  party_size?: number
  budget_amount?: number
  budget_currency?: string
  first_name?: string
  last_name?: string
  phone?: string
  comment?: string
  locale?: string
  consent?: boolean
  trip?: ILeadTripInput
}

export const LEAD_SORTS = {
  order: 'lead.orderId',
  created: 'lead.createdAt',
  client: 'lead.firstName',
  phone: 'lead.phone',
  tour: 'lead.hotelName',
  dates: 'lead.checkIn',
  party: 'lead.adults',
  price: 'lead.priceAmount',
  supplier: 'lead.supplierName',
  status: 'lead.status',
} as const

export type LeadSort = keyof typeof LEAD_SORTS

export interface ILeadQuery {
  status?: string
  q?: string
  sort?: string
  dir?: string
  manager?: string
}

export interface IStaffMember {
  uuid: string
  name: string
  role: string
}

export interface ILeadEventPayload {
  kind: string
  from: string | null
  to: string | null
  from_name: string | null
  to_name: string | null
  subject: string | null
  actor_id: string | null
  actor_name: string | null
  at: string
}

export interface ILeadPatch {
  status?: string
  reject_reason?: string
  channel?: string
  destination?: string
  planned_dates?: string
  party_size?: number
  budget_amount?: number | null
  budget_currency?: string
  manager_id?: string | null
  first_name?: string
  last_name?: string
  phone?: string
  comment?: string
}

export interface ILeadPayload {
  uuid: string
  order_id: number
  ref: string
  first_response_at: string | null
  consent_at: string | null
  source: string
  status: string
  reject_reason: string
  channel: string
  destination: string
  planned_dates: string
  party_size: number
  budget_amount: number | null
  budget_currency: string
  manager_id: string | null
  manager_name: string
  user_id: string | null
  first_name: string
  last_name: string
  phone: string
  comment: string
  locale: string
  hotel_name: string
  supplier_name: string
  check_in: string | null
  nights: number
  adults: number
  children: number
  price_amount: number | null
  price_currency: string
  route_from: string
  route_to: string
  trip: Record<string, unknown>
  created_at: string
  updated_at: string
}

const MAX_COMMENT = 2000

const PERSON_KINDS: string[] = [LeadEventKind.Created, LeadEventKind.Taken, LeadEventKind.Assigned, LeadEventKind.OrderAssigned]

const displayName = (user: Pick<UserEntity, 'firstName' | 'lastName' | 'email'>): string =>
  [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email

const PHONE_FRAGMENT_MIN = 4

const text = (value: unknown, limit = 160): string =>
  typeof value === 'string' ? value.trim().slice(0, limit) : ''

const asDate = (value: unknown): string | null =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) ? String(value) : null

const count = (value: unknown): number =>
  Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : 0

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(LeadEntity)
    private readonly leads: Repository<LeadEntity>,
    @InjectRepository(LeadEventEntity)
    private readonly events: Repository<LeadEventEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  private guard: ((leadId: string, next: string) => Promise<void>) | null = null

  registerStatusGuard(guard: (leadId: string, next: string) => Promise<void>): void {
    this.guard = guard
  }

  private release: ((leadId: string) => Promise<() => Promise<void>>) | null = null

  registerRemovalHook(release: (leadId: string) => Promise<() => Promise<void>>): void {
    this.release = release
  }

  async submit(
    input: ILeadInput,
    source = LeadSource.Site,
    userId: string | null = null,
    actorId: string | null = null,
  ): Promise<{ uuid: string, order_id: number }> {
    const firstName = text(input.first_name, 120)
    const phone = text(input.phone, 40)

    if (!firstName) throw new BadRequestException('A first name is required')
    if (!phone) throw new BadRequestException('A phone number is required')

    if (source === LeadSource.Site && !userId && input.consent !== true) {
      throw new BadRequestException('Consent to the processing of personal data is required')
    }

    const trip = input.trip ?? {}
    const amount = Number(trip.price_amount)

    const lead = this.leads.create({
      status: LeadStatus.New,
      source,
      firstName,
      lastName: text(input.last_name, 120),
      phone,
      comment: text(input.comment, MAX_COMMENT),
      locale: text(input.locale, 8) || 'ru',
      channel: text(input.channel, 24) || (source === LeadSource.Manual ? 'manual' : 'site'),
      destination: text(input.destination, 120) || text(trip.route_to, 120),
      plannedDates: text(input.planned_dates, 120),
      partySize: count(input.party_size) || count(trip.adults) + count(trip.children),
      budgetAmount: Number.isFinite(Number(input.budget_amount)) && Number(input.budget_amount) > 0
        ? String(input.budget_amount)
        : null,
      budgetCurrency: text(input.budget_currency, 8),
      managerId: source === LeadSource.Manual ? actorId : null,
      userId,
      hotelName: text(trip.hotel_name, 240),
      supplierName: text(trip.supplier_name, 120),
      checkIn: asDate(trip.check_in),
      nights: count(trip.nights),
      adults: count(trip.adults),
      children: count(trip.children),
      priceAmount: Number.isFinite(amount) && amount > 0 ? String(amount) : null,
      priceCurrency: text(trip.price_currency, 8),
      routeFrom: text(trip.route_from, 120),
      routeTo: text(trip.route_to, 120),
      trip: trip as Record<string, unknown>,
      consentAt: input.consent === true ? new Date() : null,
    })

    const saved = await this.leads.save(lead)
    const stored = await this.leads.findOne({ where: { id: saved.id } })

    await this.record(this.events.manager, saved.id, LeadEventKind.Created, {
      to: saved.managerId,
      actorId: actorId ?? userId,
    })

    return { uuid: saved.id, order_id: Number(stored?.orderId ?? 0) }
  }

  async one(id: string, viewer: IViewer): Promise<ILeadPayload> {
    const lead = await this.visible(id, viewer)
    const names = await this.namesOf([lead.managerId])

    return this.toPayload(lead, names)
  }

  async list(query: ILeadQuery, viewer: IViewer): Promise<ILeadPayload[]> {
    const column = LEAD_SORTS[query.sort as LeadSort] ?? LEAD_SORTS.order
    const direction = query.dir === 'asc' ? 'ASC' : 'DESC'

    const builder = this.leads.createQueryBuilder('lead')

    if (!seesEveryone(viewer)) {
      builder.andWhere(new Brackets((where) => {
        where
          .where('lead.managerId = :viewer', { viewer: viewer.id })
          .orWhere('(lead.managerId is null and lead.status in (:...queue))', { queue: QUEUE_STATUSES })
      }))
    }

    if (query.manager === 'me') builder.andWhere('lead.managerId = :me', { me: viewer.id })
    else if (query.manager === 'none') builder.andWhere('lead.managerId is null')
    else if (query.manager && /^[0-9a-f-]{36}$/i.test(query.manager)) {
      builder.andWhere('lead.managerId = :manager', { manager: query.manager })
    }

    if (query.status && LEAD_STATUSES.includes(query.status as LeadStatus)) {
      builder.andWhere('lead.status = :status', { status: query.status })
    }

    const needle = (query.q ?? '').trim()
    const byRef = numberFromReference(needle, LEAD_PREFIX)

    if (byRef !== null) {
      builder.andWhere('lead.orderId = :number', { number: byRef })
    }
    else if (needle) {
      const like = `%${needle.toLowerCase()}%`
      const digits = needle.replace(/\D/g, '')

      builder.andWhere(new Brackets((where) => {
        where
          .where('lower(lead.firstName) like :like', { like })
          .orWhere('lower(lead.lastName) like :like', { like })
          .orWhere('lower(lead.hotelName) like :like', { like })
          .orWhere('lower(lead.supplierName) like :like', { like })
          .orWhere('cast(lead.orderId as text) like :like', { like })

        if (digits.length >= PHONE_FRAGMENT_MIN) {
          where.orWhere('lead.phone like :phone', { phone: `%${digits}%` })
        }
      }))
    }

    const rows = await builder
      .orderBy(column, direction, 'NULLS LAST')
      .take(500)
      .getMany()

    const names = await this.namesOf(rows.map(row => row.managerId))

    return rows.map(row => this.toPayload(row, names))
  }

  async patch(id: string, input: ILeadPatch, viewer: IViewer): Promise<ILeadPayload> {
    const lead = await this.visible(id, viewer)

    return this.leads.manager.transaction(async (manager) => {
      if (input.manager_id !== undefined && (input.manager_id || null) !== lead.managerId) {
        await this.reassign(manager, lead, input.manager_id || null, viewer)
      }

      if (input.status !== undefined && input.status !== lead.status) {
        if (!LEAD_STATUSES.includes(input.status as LeadStatus)) {
          throw new BadRequestException('Unknown status')
        }

        const allowed = LEAD_TRANSITIONS[lead.status as LeadStatus] ?? []

        if (!allowed.includes(input.status as LeadStatus)) {
          throw new ConflictException(`A lead cannot go from ${lead.status} to ${input.status}`)
        }

        await this.guard?.(id, input.status)

        if (lead.status === LeadStatus.New && !lead.firstResponseAt) lead.firstResponseAt = new Date()

        if (!lead.managerId) await this.assign(manager, lead, viewer.id, LeadEventKind.Taken, viewer.id)

        await this.record(manager, lead.id, LeadEventKind.Status, {
          from: lead.status,
          to: input.status,
          actorId: viewer.id,
        })

        lead.status = input.status
      }

      if (input.comment !== undefined) lead.comment = text(input.comment, MAX_COMMENT)
      if (input.reject_reason !== undefined) lead.rejectReason = text(input.reject_reason, 500)
      if (input.channel !== undefined) lead.channel = text(input.channel, 24)
      if (input.destination !== undefined) lead.destination = text(input.destination, 120)
      if (input.planned_dates !== undefined) lead.plannedDates = text(input.planned_dates, 120)
      if (input.party_size !== undefined) lead.partySize = count(input.party_size)
      if (input.budget_currency !== undefined) lead.budgetCurrency = text(input.budget_currency, 8)
      if (input.first_name !== undefined) lead.firstName = text(input.first_name, 120)
      if (input.last_name !== undefined) lead.lastName = text(input.last_name, 120)
      if (input.phone !== undefined) lead.phone = text(input.phone, 40)

      if (input.budget_amount !== undefined) {
        lead.budgetAmount = input.budget_amount === null ? null : String(input.budget_amount)
      }

      lead.updatedAt = new Date()

      await manager.getRepository(LeadEntity).save(lead)

      return this.toPayload(lead, await this.namesOf([lead.managerId]))
    })
  }

  async take(id: string, viewer: IViewer): Promise<ILeadPayload> {
    const lead = await this.visible(id, viewer)

    if (lead.managerId && lead.managerId !== viewer.id) {
      throw new ConflictException('This lead is already handled by another manager')
    }

    if (!lead.managerId) {
      await this.leads.manager.transaction(async (manager) => {
        await this.assign(manager, lead, viewer.id, LeadEventKind.Taken, viewer.id)

        lead.updatedAt = new Date()

        await manager.getRepository(LeadEntity).save(lead)
      })
    }

    return this.toPayload(lead, await this.namesOf([lead.managerId]))
  }

  async claimForOrder(manager: EntityManager, lead: LeadEntity, viewer: IViewer): Promise<void> {
    if (lead.managerId) return

    await this.assign(manager, lead, viewer.id, LeadEventKind.Taken, viewer.id)

    lead.updatedAt = new Date()

    await manager.getRepository(LeadEntity).save(lead)
  }

  async history(id: string, viewer: IViewer): Promise<ILeadEventPayload[]> {
    await this.visible(id, viewer)

    const rows = await this.events.find({ where: { leadId: id }, order: { createdAt: 'ASC' } })
    const people = rows.flatMap(row => [row.actorId, ...(PERSON_KINDS.includes(row.kind) ? [row.fromValue, row.toValue] : [])])
    const names = await this.namesOf(people)
    const person = (kind: string, value: string | null) =>
      PERSON_KINDS.includes(kind) && value ? names.get(value) ?? null : null

    return rows.map(row => ({
      kind: row.kind,
      from: row.fromValue,
      to: row.toValue,
      from_name: person(row.kind, row.fromValue),
      to_name: person(row.kind, row.toValue),
      subject: row.subject,
      actor_id: row.actorId,
      actor_name: row.actorId ? names.get(row.actorId) ?? null : null,
      at: row.createdAt.toISOString(),
    }))
  }

  async staff(): Promise<IStaffMember[]> {
    const rows = await this.users.find({
      where: { role: In(STAFF_ROLES) },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      order: { firstName: 'ASC', lastName: 'ASC' },
    })

    return rows.map(row => ({ uuid: row.id, name: displayName(row), role: row.role }))
  }

  async record(
    manager: EntityManager,
    leadId: string,
    kind: LeadEventKind,
    change: { from?: string | null, to?: string | null, subject?: string | null, actorId: string | null },
  ): Promise<void> {
    await manager.getRepository(LeadEventEntity).save({
      leadId,
      kind,
      fromValue: change.from ?? null,
      toValue: change.to ?? null,
      subject: change.subject ?? null,
      actorId: change.actorId,
    })
  }

  async namesOf(ids: Array<string | null | undefined>): Promise<Map<string, string>> {
    const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))]

    if (!wanted.length) return new Map()

    const rows = await this.users.find({
      where: { id: In(wanted) },
      select: { id: true, firstName: true, lastName: true, email: true },
    })

    return new Map(rows.map(row => [row.id, displayName(row)]))
  }

  async assertStaff(id: string): Promise<void> {
    const found = await this.users.findOne({ where: { id, role: In(STAFF_ROLES) }, select: { id: true } })

    if (!found) throw new BadRequestException('A lead can only go to an agent or a manager')
  }

  private async visible(id: string, viewer: IViewer): Promise<LeadEntity> {
    const lead = await this.leads.findOne({ where: { id } })

    if (!lead || !canSeeLead(viewer, lead)) throw new NotFoundException('Lead not found')

    return lead
  }

  private async reassign(manager: EntityManager, lead: LeadEntity, target: string | null, viewer: IViewer): Promise<void> {
    if (!seesEveryone(viewer)) throw new ForbiddenException('Only a manager can reassign a lead')

    if (target) await this.assertStaff(target)

    await this.assign(manager, lead, target, LeadEventKind.Assigned, viewer.id)
  }

  private async assign(
    manager: EntityManager,
    lead: LeadEntity,
    target: string | null,
    kind: LeadEventKind,
    actorId: string,
  ): Promise<void> {
    const previous = lead.managerId

    await manager.query(
      `update orders set manager_id = $1, updated_at = now()
       where lead_id = $2 and (manager_id is null or manager_id = $3)`,
      [target, lead.id, previous],
    )

    await this.record(manager, lead.id, kind, { from: previous, to: target, actorId })

    lead.managerId = target
  }

  async remove(id: string, viewer: IViewer): Promise<{ removed: boolean }> {
    await this.visible(id, viewer)

    const cleanup = await this.release?.(id)
    const result = await this.leads.delete({ id })

    if (!result.affected) throw new NotFoundException('Lead not found')

    await cleanup?.()

    return { removed: true }
  }

  private toPayload(row: LeadEntity, names: Map<string, string> = new Map()): ILeadPayload {
    return {
      uuid: row.id,
      order_id: Number(row.orderId ?? 0),
      ref: reference(LEAD_PREFIX, Number(row.orderId ?? 0), row.createdAt),
      first_response_at: row.firstResponseAt ? row.firstResponseAt.toISOString() : null,
      consent_at: row.consentAt ? row.consentAt.toISOString() : null,
      source: row.source,
      status: row.status,
      reject_reason: row.rejectReason ?? '',
      channel: row.channel ?? 'site',
      destination: row.destination ?? '',
      planned_dates: row.plannedDates ?? '',
      party_size: row.partySize ?? 0,
      budget_amount: row.budgetAmount === null ? null : Number(row.budgetAmount),
      budget_currency: row.budgetCurrency ?? '',
      manager_id: row.managerId,
      manager_name: row.managerId ? names.get(row.managerId) ?? '' : '',
      user_id: row.userId,
      first_name: row.firstName,
      last_name: row.lastName,
      phone: row.phone,
      comment: row.comment,
      locale: row.locale,
      hotel_name: row.hotelName,
      supplier_name: row.supplierName,
      check_in: row.checkIn,
      nights: row.nights,
      adults: row.adults,
      children: row.children,
      price_amount: row.priceAmount === null ? null : Number(row.priceAmount),
      price_currency: row.priceCurrency,
      route_from: row.routeFrom,
      route_to: row.routeTo,
      trip: row.trip ?? {},
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    }
  }
}
