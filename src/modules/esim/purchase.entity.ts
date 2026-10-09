import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Entity('esim_purchases')
export class EsimPurchaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'bigint', generated: 'increment' })
  number!: string

  @Index({ unique: true })
  @Column({ type: 'text' })
  token!: string

  @Index()
  @Column({ type: 'text' })
  status!: string

  @Column({ type: 'text' })
  country!: string

  @Column({ name: 'plan_id', type: 'text' })
  planId!: string

  @Column({ type: 'jsonb' })
  plan!: Record<string, unknown>

  @Column({ type: 'text' })
  provider!: string

  @Column({ name: 'wholesale_usd', type: 'numeric' })
  wholesaleUsd!: string

  @Column({ name: 'fx_rate', type: 'numeric' })
  fxRate!: string

  @Column({ name: 'margin_percent', type: 'numeric' })
  marginPercent!: string

  @Column({ name: 'price_uzs', type: 'bigint' })
  priceUzs!: string

  @Column({ type: 'text' })
  email!: string

  @Index()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null

  @Column({ type: 'text' })
  phone!: string

  @Column({ type: 'text', default: 'ru' })
  locale!: string

  @Column({ name: 'payment_method', type: 'text' })
  paymentMethod!: string

  @Index()
  @Column({ name: 'payment_txn', type: 'text', nullable: true })
  paymentTxn!: string | null

  @Column({ name: 'payment_state', type: 'int', nullable: true })
  paymentState!: number | null

  @Column({ name: 'payment_created_ms', type: 'bigint', nullable: true })
  paymentCreatedMs!: string | null

  @Column({ name: 'payment_performed_ms', type: 'bigint', nullable: true })
  paymentPerformedMs!: string | null

  @Column({ name: 'payment_cancelled_ms', type: 'bigint', nullable: true })
  paymentCancelledMs!: string | null

  @Column({ name: 'payment_cancel_reason', type: 'int', nullable: true })
  paymentCancelReason!: number | null

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt!: Date | null

  @Column({ type: 'jsonb', nullable: true })
  esim!: Record<string, unknown> | null

  @Column({ name: 'issue_error', type: 'text', default: '' })
  issueError!: string

  @Column({ name: 'issue_attempts', type: 'int', default: 0 })
  issueAttempts!: number

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date
}
