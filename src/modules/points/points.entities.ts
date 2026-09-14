import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export enum PointsReason {
  Order = 'order',
  Adjustment = 'adjustment',
}

export const POINTS_CURRENCIES = ['USD', 'EUR', 'UZS'] as const

export type PointsCurrency = typeof POINTS_CURRENCIES[number]

export type PointsRates = Record<PointsCurrency, number>

export const DEFAULT_RATES: PointsRates = { USD: 10, EUR: 11, UZS: 0.0008 }

@Entity('points_tiers')
export class PointsTierEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'text' })
  name!: string

  @Column({ type: 'int' })
  threshold!: number

  @Column({ name: 'discount_percent', type: 'numeric', precision: 5, scale: 2 })
  discountPercent!: string

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date
}

@Entity('points_settings')
export class PointsSettingsEntity {
  @PrimaryColumn({ type: 'int' })
  id!: number

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  rates!: Partial<PointsRates>

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date
}

@Entity('points_transactions')
export class PointsTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Column({ type: 'int' })
  delta!: number

  @Column({ type: 'text' })
  reason!: string

  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId!: string | null

  @Column({ type: 'text', default: '' })
  note!: string

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId!: string | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date
}
