import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { ContentListEntity } from './content-list.entity'
import { ContentItemTranslationEntity } from './content-item-translation.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Entity('content_items')
export class ContentItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index()
  @Column({ name: 'list_id', type: 'uuid' })
  listId!: string

  @ManyToOne(() => ContentListEntity, list => list.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'list_id' })
  list!: ContentListEntity

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl!: string | null

  @Column({ type: 'text', nullable: true })
  link!: string | null

  @Column({ type: 'int', default: 0 })
  position!: number

  @Column({ name: 'badge_type', type: 'text', nullable: true })
  badgeType!: string | null

  @OneToMany(() => ContentItemTranslationEntity, translation => translation.item, { cascade: true })
  translations!: ContentItemTranslationEntity[]
}
