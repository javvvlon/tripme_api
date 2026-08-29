import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export enum LeadStatus {
  New = 'new',
  InProgress = 'in_progress',
  Booked = 'booked',
  Rejected = 'rejected',
}

export const LEAD_STATUSES = Object.values(LeadStatus)

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

  @Column({ name: 'supplier_order_id', type: 'text', default: '' })
  supplierOrderId!: string

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

  @Column({ name: 'passport_id', type: 'text', default: '' })
  passportId!: string

  @Column({ name: 'passport_expires_at', type: 'date', nullable: true })
  passportExpiresAt!: string | null

  @Column({ type: 'text', default: '' })
  comment!: string

  @Column({ type: 'text', default: 'ru' })
  locale!: string

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
