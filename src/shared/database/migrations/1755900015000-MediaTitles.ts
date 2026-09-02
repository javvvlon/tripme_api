import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class MediaTitles1755900015000 implements MigrationInterface {
  name = 'MediaTitles1755900015000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists media_titles (
        path       text primary key,
        title      text        not null default '',
        updated_at timestamptz not null default now()
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists media_titles`)
  }
}
