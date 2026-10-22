import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Entity('notes')
@Index(['kind', 'kindNo'], { unique: true })
export class NoteEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'text' })
  kind!: string

  @Column({ name: 'kind_no', type: 'int' })
  kindNo!: number

  @Column({ type: 'text' })
  title!: string

  @Column({ type: 'text', default: '' })
  body!: string

  @Column({ type: 'text', default: '' })
  rationale!: string

  @Column({ type: 'text', array: true, default: () => `'{}'` })
  refs!: string[]

  @Index()
  @Column({ name: 'author_id', type: 'uuid' })
  authorId!: string

  @Column({ name: 'supersedes_id', type: 'uuid', nullable: true })
  supersedesId!: string | null

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date
}

@Entity('note_acks')
@Index(['noteId', 'userId'], { unique: true })
export class NoteAckEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'note_id', type: 'uuid' })
  noteId!: string

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt!: Date | null

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date
}
