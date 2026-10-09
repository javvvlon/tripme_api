import { Column, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Entity('conversations')
export class ConversationEntity {
  @PrimaryColumn({ name: 'client_id', type: 'uuid' })
  clientId!: string

  @Column({ name: 'last_message_at', type: 'timestamptz', nullable: true })
  lastMessageAt!: Date | null

  @Column({ name: 'client_read_at', type: 'timestamptz', nullable: true })
  clientReadAt!: Date | null

  @Column({ name: 'staff_read_at', type: 'timestamptz', nullable: true })
  staffReadAt!: Date | null

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date
}

@Entity('messages')
@Index(['clientId', 'createdAt'])
export class MessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'client_id', type: 'uuid' })
  clientId!: string

  @Column({ name: 'author_id', type: 'uuid', nullable: true })
  authorId!: string | null

  @Column({ name: 'author_role', type: 'text' })
  authorRole!: string

  @Column({ type: 'text' })
  body!: string

  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId!: string | null

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date
}
