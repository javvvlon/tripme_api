import { Column, Entity, Index, PrimaryColumn } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 *
 * What the CMS knows about a stored file beyond the bytes: the name an
 * editor gave it, and the folder they filed it under.
 *
 * Neither is part of the object key. A folder here is a label, not a path —
 * moving a file between folders leaves its URL alone, so every banner, list
 * and article pointing at it keeps resolving.
 */
@Entity('media_files')
export class MediaFileEntity {
  /** The object key. A row exists only once a file has a name or a folder. */
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
