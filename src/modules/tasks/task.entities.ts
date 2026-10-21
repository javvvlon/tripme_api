import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Entity('tasks')
export class TaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'task_no', type: 'bigint', generated: 'increment' })
  taskNo!: string

  @Column({ type: 'text' })
  title!: string

  @Column({ type: 'text', default: '' })
  description!: string

  @Index()
  @Column({ type: 'text', default: 'todo' })
  status!: string

  @Column({ type: 'text', default: 'medium' })
  priority!: string

  @Index()
  @Column({ name: 'assignee_id', type: 'uuid', nullable: true })
  assigneeId!: string | null

  @Index()
  @Column({ name: 'author_id', type: 'uuid' })
  authorId!: string

  @Column({ name: 'due_on', type: 'date', nullable: true })
  dueOn!: string | null

  @Column({ type: 'text', array: true, default: () => `'{}'` })
  labels!: string[]

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date
}

@Entity('task_events')
@Index(['taskId', 'createdAt'])
export class TaskEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'task_id', type: 'uuid' })
  taskId!: string

  @Column({ type: 'text' })
  kind!: string

  @Column({ name: 'from_value', type: 'text', nullable: true })
  fromValue!: string | null

  @Column({ name: 'to_value', type: 'text', nullable: true })
  toValue!: string | null

  @Column({ type: 'text', default: '' })
  body!: string

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId!: string | null

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date
}
