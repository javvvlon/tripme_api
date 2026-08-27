import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { ContentItemEntity } from './content-item.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Entity('content_item_translations')
@Index(['itemId', 'locale'], { unique: true })
export class ContentItemTranslationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'item_id', type: 'uuid' })
  itemId!: string

  @ManyToOne(() => ContentItemEntity, item => item.translations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item!: ContentItemEntity

  @Column({ type: 'text' })
  locale!: string

  @Column({ type: 'text' })
  title!: string

  @Column({ type: 'text', nullable: true })
  description!: string | null

  @Column({ name: 'badge_label', type: 'text', nullable: true })
  badgeLabel!: string | null
}
