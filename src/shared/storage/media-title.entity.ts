import { Column, Entity, PrimaryColumn } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Entity('media_titles')
export class MediaTitleEntity {
  /**
   * The object key, not a generated id. A title belongs to the bytes at a
   * path; when those bytes are deleted the title goes with them.
   */
  @PrimaryColumn({ type: 'text' })
  path!: string

  @Column({ type: 'text', default: '' })
  title!: string

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date
}
