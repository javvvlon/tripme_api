import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { LeadEntity } from '~/modules/leads/lead.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export enum OrderStatus {
  Draft = 'draft',
  Requested = 'requested',
  Confirmed = 'confirmed',
  Issued = 'issued',
  Travelling = 'travelling',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export const ORDER_STATUSES = Object.values(OrderStatus)

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.Draft]: [OrderStatus.Requested, OrderStatus.Cancelled],
  [OrderStatus.Requested]: [OrderStatus.Confirmed, OrderStatus.Draft, OrderStatus.Cancelled],
  [OrderStatus.Confirmed]: [OrderStatus.Issued, OrderStatus.Requested, OrderStatus.Cancelled],
  [OrderStatus.Issued]: [OrderStatus.Travelling, OrderStatus.Cancelled],
  [OrderStatus.Travelling]: [OrderStatus.Completed],
  [OrderStatus.Completed]: [],
  [OrderStatus.Cancelled]: [],
}

export const PASSPORT_CHECKED_STATUSES: OrderStatus[] = [
  OrderStatus.Confirmed,
  OrderStatus.Issued,
  OrderStatus.Travelling,
]

export const PASSPORT_MARGIN_MONTHS = 6

export const COMMITTED_STATUSES: OrderStatus[] = [
  OrderStatus.Confirmed,
  OrderStatus.Issued,
  OrderStatus.Travelling,
  OrderStatus.Completed,
]

export const SETTLED_STATUSES: OrderStatus[] = [
  OrderStatus.Issued,
  OrderStatus.Travelling,
  OrderStatus.Completed,
]

@Entity('orders')
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'order_no', type: 'bigint', generated: 'increment' })
  orderNo!: string

  @Index()
  @Column({ name: 'lead_id', type: 'uuid' })
  leadId!: string

  @ManyToOne(() => LeadEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead!: LeadEntity

  @Index()
  @Column({ type: 'text', default: OrderStatus.Draft })
  status!: string

  @Column({ name: 'supplier_order_id', type: 'text', default: '' })
  supplierOrderId!: string

  @Column({ name: 'passport_id', type: 'text', default: '' })
  passportId!: string

  @Column({ name: 'passport_expires_at', type: 'date', nullable: true })
  passportExpiresAt!: string | null

  @Column({ name: 'deal_date', type: 'date', nullable: true })
  dealDate!: string | null

  @Column({ name: 'traveller_name', type: 'text', default: '' })
  travellerName!: string

  @Column({ type: 'text', default: '' })
  country!: string

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

  @Column({ name: 'return_date', type: 'date', nullable: true })
  returnDate!: string | null

  @Column({ name: 'manager_id', type: 'uuid', nullable: true })
  managerId!: string | null

  @Column({ type: 'text', default: '' })
  branch!: string

  @Column({ name: 'price_amount', type: 'numeric', nullable: true })
  priceAmount!: string | null

  @Column({ name: 'price_currency', type: 'text', default: '' })
  priceCurrency!: string

  @Column({ type: 'jsonb', default: () => `'{}'` })
  trip!: Record<string, unknown>

  @Column({ type: 'text', default: '' })
  note!: string

  @Column({ name: 'deposit_percent', type: 'int', nullable: true })
  depositPercent!: number | null

  @Column({ name: 'contract_signed_at', type: 'timestamptz', nullable: true })
  contractSignedAt!: Date | null

  @Column({ name: 'contract_document_id', type: 'uuid', nullable: true })
  contractDocumentId!: string | null

  @Column({ name: 'legacy_paid', type: 'boolean', default: false })
  legacyPaid!: boolean

  @Column({ name: 'cancel_reason', type: 'text', default: '' })
  cancelReason!: string

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date
}
