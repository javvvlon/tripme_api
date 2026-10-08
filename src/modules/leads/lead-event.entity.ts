import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export enum LeadEventKind {
  Created = 'created',
  Taken = 'taken',
  Assigned = 'assigned',
  Status = 'status',
  OrderAssigned = 'order_assigned',
}

@Entity('lead_events')
export class LeadEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index()
  @Column({ name: 'lead_id', type: 'uuid' })
  leadId!: string

  @Column({ type: 'text' })
  kind!: string

  @Column({ name: 'from_value', type: 'text', nullable: true })
  fromValue!: string | null

  @Column({ name: 'to_value', type: 'text', nullable: true })
  toValue!: string | null

  @Column({ type: 'text', nullable: true })
  subject!: string | null

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId!: string | null

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date
}
