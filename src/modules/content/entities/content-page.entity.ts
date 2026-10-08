import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Entity('content_pages')
export class ContentPageEntity {
  @PrimaryColumn({ type: 'text' })
  page!: string

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  seo!: Record<string, { title?: string, description?: string }>

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}
