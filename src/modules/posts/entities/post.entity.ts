import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { PostTranslationEntity } from './post-translation.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Entity('posts')
export class PostEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index({ unique: true })
  @Column({ type: 'text' })
  slug!: string

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl!: string | null

  @Column({ name: 'badge_type', type: 'text', nullable: true })
  badgeType!: string | null

  @Column({ type: 'text', nullable: true })
  link!: string | null

  @Column({ name: 'is_published', type: 'boolean', default: false })
  isPublished!: boolean

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date

  @OneToMany(() => PostTranslationEntity, translation => translation.post, { cascade: true })
  translations!: PostTranslationEntity[]
}
