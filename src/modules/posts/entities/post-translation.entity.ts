import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { PostEntity } from './post.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Entity('post_translations')
@Index(['postId', 'locale'], { unique: true })
export class PostTranslationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'post_id', type: 'uuid' })
  postId!: string

  @ManyToOne(() => PostEntity, post => post.translations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post!: PostEntity

  @Column({ type: 'text' })
  locale!: string

  @Column({ type: 'text', default: '' })
  title!: string

  @Column({ type: 'text', default: '' })
  excerpt!: string

  @Column({ type: 'text', default: '' })
  body!: string

  @Column({ name: 'badge_label', type: 'text', nullable: true })
  badgeLabel!: string | null
}
