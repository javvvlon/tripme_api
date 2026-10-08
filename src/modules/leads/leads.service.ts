import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Brackets, Repository } from 'typeorm'
import { pageOf } from '~/shared/helpers/pagination'
import type { IPage, IPageRequest } from '~/shared/helpers/pagination'
import { LEAD_PREFIX, numberFromReference, reference } from '~/shared/helpers/reference'
import { LEAD_STATUSES, LEAD_TRANSITIONS, LeadEntity, LeadSource, LeadStatus } from './lead.entity'

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
  manager_id?: string | null
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
  trip?: ILeadTripInput
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

const PHONE_FRAGMENT_MIN = 4

const text = (value: unknown, limit = 160): string =>
  typeof value === 'string' ? value.trim().slice(0, limit) : ''

const asDate = (value: unknown): string | null =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) ? String(value) : null

const count = (value: unknown): number =>
  Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : 0

const tripColumns = (trip: ILeadTripInput): Partial<LeadEntity> => {
  const amount = Number(trip.price_amount)

  return {
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
  }
}

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(LeadEntity)
    private readonly leads: Repository<LeadEntity>,
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
  ): Promise<{ uuid: string, order_id: number }> {
    const firstName = text(input.first_name, 120)
    const phone = text(input.phone, 40)

    if (!firstName) throw new BadRequestException('A first name is required')
    if (!phone) throw new BadRequestException('A phone number is required')

    if (source === LeadSource.Site && !userId && input.consent !== true) {
      throw new BadRequestException('Consent to the processing of personal data is required')
    }

    const trip = input.trip ?? {}

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
      managerId: typeof input.manager_id === 'string' ? input.manager_id : null,
      userId,
      ...tripColumns(trip),
      consentAt: input.consent === true ? new Date() : null,
    })

    const saved = await this.leads.save(lead)
    const stored = await this.leads.findOne({ where: { id: saved.id } })

    return { uuid: saved.id, order_id: Number(stored?.orderId ?? 0) }
  }

  async one(id: string): Promise<ILeadPayload> {
    const lead = await this.leads.findOne({ where: { id } })

    if (!lead) throw new NotFoundException('Lead not found')

    return this.toPayload(lead)
  }

  async list(query: ILeadQuery = {}): Promise<ILeadPayload[]> {
    const rows = await this.filtered(query).take(500).getMany()

    return rows.map(row => this.toPayload(row))
  }

  async page(query: ILeadQuery, request: IPageRequest): Promise<IPage<ILeadPayload, { all: number, fresh: number }>> {
    const [rows, total] = await this.filtered(query).skip(request.skip).take(request.perPage).getManyAndCount()
    const [all, fresh] = await Promise.all([
      this.leads.count(),
      this.leads.count({ where: { status: 'new' } }),
    ])

    return pageOf(rows.map(row => this.toPayload(row)), total, request, { all, fresh })
  }

  private filtered(query: ILeadQuery) {
    const column = LEAD_SORTS[query.sort as LeadSort] ?? LEAD_SORTS.order
    const direction = query.dir === 'asc' ? 'ASC' : 'DESC'

    const builder = this.leads.createQueryBuilder('lead')

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

    return builder
      .orderBy(column, direction, 'NULLS LAST')
      .addOrderBy('lead.orderId', 'DESC')
  }

  async patch(id: string, input: ILeadPatch): Promise<ILeadPayload> {
    const lead = await this.leads.findOne({ where: { id } })

    if (!lead) throw new NotFoundException('Lead not found')

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

      lead.status = input.status
    }

    if (input.comment !== undefined) lead.comment = text(input.comment, MAX_COMMENT)
    if (input.reject_reason !== undefined) lead.rejectReason = text(input.reject_reason, 500)
    if (input.channel !== undefined) lead.channel = text(input.channel, 24)
    if (input.destination !== undefined) lead.destination = text(input.destination, 120)
    if (input.planned_dates !== undefined) lead.plannedDates = text(input.planned_dates, 120)
    if (input.party_size !== undefined) lead.partySize = count(input.party_size)
    if (input.budget_currency !== undefined) lead.budgetCurrency = text(input.budget_currency, 8)
    if (input.manager_id !== undefined) lead.managerId = input.manager_id || null
    if (input.first_name !== undefined) lead.firstName = text(input.first_name, 120)
    if (input.last_name !== undefined) lead.lastName = text(input.last_name, 120)
    if (input.phone !== undefined) lead.phone = text(input.phone, 40)

    if (input.budget_amount !== undefined) {
      lead.budgetAmount = input.budget_amount === null ? null : String(input.budget_amount)
    }

    if (input.trip && typeof input.trip === 'object') {
      if (!text(input.trip.hotel_name, 240)) throw new BadRequestException('A tour needs a hotel')

      Object.assign(lead, tripColumns(input.trip))

      if (!lead.destination) lead.destination = lead.routeTo
      if (!lead.partySize) lead.partySize = lead.adults + lead.children
    }

    lead.updatedAt = new Date()

    await this.leads.save(lead)

    return this.toPayload(lead)
  }

  async remove(id: string): Promise<{ removed: boolean }> {
    const cleanup = await this.release?.(id)
    const result = await this.leads.delete({ id })

    if (!result.affected) throw new NotFoundException('Lead not found')

    await cleanup?.()

    return { removed: true }
  }

  private toPayload(row: LeadEntity): ILeadPayload {
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
      manager_name: '',
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
