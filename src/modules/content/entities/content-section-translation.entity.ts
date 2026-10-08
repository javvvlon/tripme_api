import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { ContentSectionEntity } from './content-section.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Entity('content_section_translations')
@Index(['sectionId', 'locale'], { unique: true })
export class ContentSectionTranslationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'section_id', type: 'uuid' })
  sectionId!: string

  @ManyToOne(() => ContentSectionEntity, section => section.translations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section!: ContentSectionEntity

  @Column({ type: 'text' })
  locale!: string

  @Column({ type: 'text' })
  title!: string

  @Column({ type: 'text', nullable: true })
  subtitle!: string | null

  @Column({ type: 'text', nullable: true })
  eyebrow!: string | null

  @Column({ type: 'text', nullable: true })
  body!: string | null

  @Column({ name: 'cta_label', type: 'text', nullable: true })
  ctaLabel!: string | null
}
