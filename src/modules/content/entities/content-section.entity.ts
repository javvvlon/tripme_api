import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { ContentListEntity } from './content-list.entity'
import { ContentLayoutEntity } from './content-layout.entity'
import { ContentSectionTranslationEntity } from './content-section-translation.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Entity('content_sections')
export class ContentSectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index()
  @Column({ type: 'text', default: 'home' })
  page!: string

  @Column({ type: 'text', nullable: true })
  link!: string | null

  @Column({ type: 'text', default: 'cards' })
  kind!: string

  @Column({ type: 'text', default: 'list' })
  source!: string

  @Column({ type: 'text', default: 'list' })
  variant!: string

  @Column({ type: 'text', nullable: true })
  anchor!: string | null

  @Column({ name: 'list_id', type: 'uuid', nullable: true })
  listId!: string | null

  @ManyToOne(() => ContentListEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'list_id' })
  list!: ContentListEntity | null

  @Column({ name: 'post_ids', type: 'uuid', array: true, default: () => `'{}'` })
  postIds!: string[]

  @Column({ name: 'layout_id', type: 'uuid', nullable: true })
  layoutId!: string | null

  @ManyToOne(() => ContentLayoutEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'layout_id' })
  layout!: ContentLayoutEntity | null

  @Column({ type: 'int', default: 0 })
  position!: number

  @Column({ name: 'is_published', type: 'boolean', default: true })
  isPublished!: boolean

  @OneToMany(() => ContentSectionTranslationEntity, translation => translation.section, { cascade: true })
  translations!: ContentSectionTranslationEntity[]

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}
