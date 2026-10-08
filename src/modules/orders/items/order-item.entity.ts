import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Entity('order_items')
export class OrderItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index()
  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string

  @Column({ type: 'int', default: 0 })
  position!: number

  @Column({ type: 'text' })
  kind!: string

  @Column({ type: 'text' })
  status!: string

  @Column({ type: 'text', default: '' })
  title!: string

  @Column({ name: 'supplier_name', type: 'text', default: '' })
  supplierName!: string

  @Column({ name: 'supplier_ref', type: 'text', default: '' })
  supplierRef!: string

  @Column({ name: 'offer_id', type: 'text', default: '' })
  offerId!: string

  @Column({ name: 'service_start', type: 'date', nullable: true })
  serviceStart!: string | null

  @Column({ name: 'service_end', type: 'date', nullable: true })
  serviceEnd!: string | null

  @Column({ name: 'price_amount', type: 'numeric', nullable: true })
  priceAmount!: string | null

  @Column({ name: 'price_currency', type: 'text', default: '' })
  priceCurrency!: string

  @Column({ name: 'cost_amount', type: 'numeric', nullable: true })
  costAmount!: string | null

  @Column({ name: 'cost_currency', type: 'text', default: '' })
  costCurrency!: string

  @Column({ name: 'fx_rate', type: 'numeric', nullable: true })
  fxRate!: string | null

  @Column({ name: 'fx_date', type: 'date', nullable: true })
  fxDate!: string | null

  @Column({ name: 'required_for_confirmation', type: 'boolean', default: false })
  requiredForConfirmation!: boolean

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  details!: Record<string, unknown>

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date
}
