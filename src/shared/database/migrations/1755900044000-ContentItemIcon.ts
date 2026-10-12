import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const LEGACY: Array<[string, string]> = [
  ['/icon/win.png', 'trophy'],
  ['/icon/chat.png', 'support'],
  ['/icon/medal.png', 'medal'],
  ['/icon/notebook.png', 'doc'],
]

export class ContentItemIcon1755900044000 implements MigrationInterface {
  name = 'ContentItemIcon1755900044000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table content_items add column if not exists icon text`)

    for (const [image, icon] of LEGACY) {
      await queryRunner.query(
        `update content_items set icon = $2, image_url = null where image_url = $1`,
        [image, icon],
      )
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [image, icon] of LEGACY) {
      await queryRunner.query(
        `update content_items set image_url = $1 where icon = $2 and image_url is null`,
        [image, icon],
      )
    }

    await queryRunner.query(`alter table content_items drop column if exists icon`)
  }
}
