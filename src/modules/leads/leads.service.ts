import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { LEAD_STATUSES, LeadEntity, LeadSource, LeadStatus } from './lead.entity'

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
  first_name?: string
  last_name?: string
  phone?: string
  passport_id?: string
  passport_expires_at?: string
  comment?: string
  locale?: string
  trip?: ILeadTripInput
}

export interface ILeadPatch {
  status?: string
  supplier_order_id?: string
  comment?: string
  passport_id?: string
  passport_expires_at?: string | null
}

export interface ILeadPayload {
  uuid: string
  order_id: number
  supplier_order_id: string
  source: string
  status: string
  first_name: string
  last_name: string
  phone: string
  passport_id: string
  passport_expires_at: string | null
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
  ) {}

  async submit(input: ILeadInput, source = LeadSource.Site): Promise<{ uuid: string, order_id: number }> {
    const firstName = text(input.first_name, 120)
    const phone = text(input.phone, 40)

    if (!firstName) throw new BadRequestException('A first name is required')
    if (!phone) throw new BadRequestException('A phone number is required')

    const trip = input.trip ?? {}
    const amount = Number(trip.price_amount)

    const lead = this.leads.create({
      status: LeadStatus.New,
      source,
      firstName,
      lastName: text(input.last_name, 120),
      phone,
      passportId: text(input.passport_id, 40),
      passportExpiresAt: asDate(input.passport_expires_at),
      comment: text(input.comment, MAX_COMMENT),
      locale: text(input.locale, 8) || 'ru',
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

  async list(status?: string): Promise<ILeadPayload[]> {
    const rows = await this.leads.find({
      where: status && LEAD_STATUSES.includes(status as LeadStatus) ? { status } : {},
      order: { createdAt: 'DESC' },
      take: 500,
    })

    return rows.map(row => this.toPayload(row))
  }

  async patch(id: string, input: ILeadPatch): Promise<ILeadPayload> {
    const lead = await this.leads.findOne({ where: { id } })

    if (!lead) throw new NotFoundException('Lead not found')

    if (input.status !== undefined) {
      if (!LEAD_STATUSES.includes(input.status as LeadStatus)) {
        throw new BadRequestException('Unknown status')
      }

      lead.status = input.status
    }

    if (input.supplier_order_id !== undefined) {
      lead.supplierOrderId = text(input.supplier_order_id, 80)
    }

    if (input.comment !== undefined) lead.comment = text(input.comment, MAX_COMMENT)

    if (input.passport_id !== undefined) lead.passportId = text(input.passport_id, 40)

    if (input.passport_expires_at !== undefined) {
      lead.passportExpiresAt = asDate(input.passport_expires_at)
    }

    lead.updatedAt = new Date()

    await this.leads.save(lead)

    return this.toPayload(lead)
  }

  async remove(id: string): Promise<{ removed: boolean }> {
    const result = await this.leads.delete({ id })

    if (!result.affected) throw new NotFoundException('Lead not found')

    return { removed: true }
  }

  private toPayload(row: LeadEntity): ILeadPayload {
    return {
      uuid: row.id,
      order_id: Number(row.orderId ?? 0),
      supplier_order_id: row.supplierOrderId ?? '',
      source: row.source,
      status: row.status,
      first_name: row.firstName,
      last_name: row.lastName,
      phone: row.phone,
      passport_id: row.passportId ?? '',
      passport_expires_at: row.passportExpiresAt,
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
