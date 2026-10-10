import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Entity('order_payments')
export class PaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index()
  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string

  @Column({ name: 'item_id', type: 'uuid', nullable: true })
  itemId!: string | null

  @Column({ type: 'text' })
  direction!: string

  @Column({ type: 'numeric' })
  amount!: string

  @Column({ type: 'text' })
  currency!: string

  @Column({ name: 'fx_rate', type: 'numeric' })
  fxRate!: string

  @Column({ name: 'fx_date', type: 'date' })
  fxDate!: string

  @Column({ name: 'amount_uzs', type: 'numeric' })
  amountUzs!: string

  @Column({ type: 'jsonb', nullable: true })
  rates!: Record<string, number> | null

  @Column({ type: 'text' })
  method!: string

  @Column({ name: 'paid_at', type: 'date' })
  paidAt!: string

  @Column({ name: 'receipt_document_id', type: 'uuid', nullable: true })
  receiptDocumentId!: string | null

  @Column({ name: 'reverses_payment_id', type: 'uuid', nullable: true })
  reversesPaymentId!: string | null

  @Column({ type: 'text', default: '' })
  note!: string

  @Column({ name: 'recorded_by', type: 'uuid', nullable: true })
  recordedBy!: string | null

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date
}
