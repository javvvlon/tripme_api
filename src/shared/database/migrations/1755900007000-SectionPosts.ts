import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class SectionPosts1755900007000 implements MigrationInterface {
  name = 'SectionPosts1755900007000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table content_sections
        add column if not exists post_ids uuid[] not null default '{}'
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table content_sections drop column if exists post_ids`)
  }
}
