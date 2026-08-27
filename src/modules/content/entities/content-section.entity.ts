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

  @Column({ name: 'list_id', type: 'uuid' })
  listId!: string

  @ManyToOne(() => ContentListEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'list_id' })
  list!: ContentListEntity

  @Column({ name: 'layout_id', type: 'uuid' })
  layoutId!: string

  @ManyToOne(() => ContentLayoutEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'layout_id' })
  layout!: ContentLayoutEntity

  @Column({ type: 'int', default: 0 })
  position!: number

  @Column({ name: 'is_published', type: 'boolean', default: true })
  isPublished!: boolean

  @OneToMany(() => ContentSectionTranslationEntity, translation => translation.section, { cascade: true })
  translations!: ContentSectionTranslationEntity[]

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}
