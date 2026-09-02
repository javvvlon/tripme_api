import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { LeadEntity } from '~/modules/leads/lead.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export enum OrderStatus {
  Draft = 'draft',
  Requested = 'requested',
  Confirmed = 'confirmed',
  Paid = 'paid',
  Issued = 'issued',
  Travelling = 'travelling',
  Completed = 'completed',
}

export const ORDER_STATUSES = Object.values(OrderStatus)

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.Draft]: [OrderStatus.Requested],
  [OrderStatus.Requested]: [OrderStatus.Confirmed, OrderStatus.Draft],
  [OrderStatus.Confirmed]: [OrderStatus.Paid, OrderStatus.Requested],
  [OrderStatus.Paid]: [OrderStatus.Issued],
  [OrderStatus.Issued]: [OrderStatus.Travelling],
  [OrderStatus.Travelling]: [OrderStatus.Completed],
  [OrderStatus.Completed]: [],
}

export const SETTLED_STATUSES: OrderStatus[] = [
  OrderStatus.Paid,
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

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date
}
