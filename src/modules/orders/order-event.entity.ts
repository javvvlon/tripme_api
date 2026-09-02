import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Entity('order_events')
export class OrderEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index()
  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string

  @Column({ name: 'from_status', type: 'text', nullable: true })
  fromStatus!: string | null

  @Column({ name: 'to_status', type: 'text' })
  toStatus!: string

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId!: string | null

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date
}
