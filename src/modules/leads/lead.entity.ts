import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export enum LeadStatus {
  New = 'new',
  InProgress = 'in_progress',
  QuoteSent = 'quote_sent',
  Won = 'won',
  Rejected = 'rejected',
}

export const LEAD_STATUSES = Object.values(LeadStatus)

export const LEAD_CHANNELS = ['site', 'telegram', 'call', 'referral', 'instagram', 'walk_in', 'manual'] as const

export const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  [LeadStatus.New]: [LeadStatus.InProgress, LeadStatus.QuoteSent, LeadStatus.Rejected],
  [LeadStatus.InProgress]: [LeadStatus.QuoteSent, LeadStatus.Won, LeadStatus.Rejected],
  [LeadStatus.QuoteSent]: [LeadStatus.InProgress, LeadStatus.Won, LeadStatus.Rejected],
  [LeadStatus.Won]: [LeadStatus.InProgress, LeadStatus.Rejected],
  [LeadStatus.Rejected]: [],
}

export enum LeadSource {
  Site = 'site',
  Manual = 'manual',
}

@Entity('leads')
export class LeadEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'order_id', type: 'bigint', generated: 'increment' })
  orderId!: string

  @Column({ type: 'text', default: LeadSource.Site })
  source!: string

  @Index()
  @Column({ type: 'text', default: LeadStatus.New })
  status!: string

  @Column({ name: 'first_name', type: 'text' })
  firstName!: string

  @Column({ name: 'last_name', type: 'text', default: '' })
  lastName!: string

  @Column({ type: 'text' })
  phone!: string

  @Column({ type: 'text', default: '' })
  comment!: string

  @Column({ type: 'text', default: 'ru' })
  locale!: string

  @Column({ type: 'text', default: 'site' })
  channel!: string

  @Column({ type: 'text', default: '' })
  destination!: string

  @Column({ name: 'planned_dates', type: 'text', default: '' })
  plannedDates!: string

  @Column({ name: 'party_size', type: 'int', default: 0 })
  partySize!: number

  @Column({ name: 'budget_amount', type: 'numeric', nullable: true })
  budgetAmount!: string | null

  @Column({ name: 'budget_currency', type: 'text', default: '' })
  budgetCurrency!: string

  @Column({ name: 'manager_id', type: 'uuid', nullable: true })
  managerId!: string | null

  @Column({ name: 'reject_reason', type: 'text', default: '' })
  rejectReason!: string

  @Column({ name: 'hotel_name', type: 'text', default: '' })
  hotelName!: string

  @Column({ name: 'supplier_name', type: 'text', default: '' })
  supplierName!: string

  @Column({ name: 'check_in', type: 'date', nullable: true })
  checkIn!: string | null

  @Column({ type: 'int', default: 0 })
  nights!: number

  @Column({ type: 'int', default: 0 })
  adults!: number

  @Column({ type: 'int', default: 0 })
  children!: number

  @Column({ name: 'price_amount', type: 'numeric', nullable: true })
  priceAmount!: string | null

  @Column({ name: 'price_currency', type: 'text', default: '' })
  priceCurrency!: string

  @Column({ name: 'route_from', type: 'text', default: '' })
  routeFrom!: string

  @Column({ name: 'route_to', type: 'text', default: '' })
  routeTo!: string

  @Column({ type: 'jsonb', default: () => `'{}'` })
  trip!: Record<string, unknown>

  @Index()
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date
}
