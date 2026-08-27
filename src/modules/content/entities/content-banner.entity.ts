import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Entity('content_banners')
export class ContentBannerEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index({ unique: true })
  @Column({ type: 'text', default: 'home' })
  page!: string

  @OneToMany(() => ContentBannerTranslationEntity, translation => translation.banner, { cascade: true })
  translations!: ContentBannerTranslationEntity[]

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}

@Entity('content_banner_translations')
@Index(['bannerId', 'locale'], { unique: true })
export class ContentBannerTranslationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'banner_id', type: 'uuid' })
  bannerId!: string

  @ManyToOne(() => ContentBannerEntity, banner => banner.translations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'banner_id' })
  banner!: ContentBannerEntity

  @Column({ type: 'text' })
  locale!: string

  @Column({ type: 'text', default: '' })
  title!: string

  @Column({ type: 'text', nullable: true })
  subtitle!: string | null

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl!: string | null
}
