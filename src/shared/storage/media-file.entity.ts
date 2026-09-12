import { Column, Entity, Index, PrimaryColumn } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Entity('media_files')
export class MediaFileEntity {
  @PrimaryColumn({ type: 'text' })
  path!: string

  @Column({ type: 'text', default: '' })
  title!: string

  @Index()
  @Column({ name: 'folder_id', type: 'uuid', nullable: true })
  folderId!: string | null

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date
}
