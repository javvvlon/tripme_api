import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class MediaFolders1755900016000 implements MigrationInterface {
  name = 'MediaFolders1755900016000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    /** The table holds more than titles now, so it is named for what it is. */
    await queryRunner.query(`alter table if exists media_titles rename to media_files`)

    await queryRunner.query(`
      create table if not exists media_folders (
        id         uuid primary key default gen_random_uuid(),
        name       text        not null,
        created_at timestamptz not null default now()
      )
    `)

    await queryRunner.query(`
      alter table media_files
      add column if not exists folder_id uuid
      references media_folders (id) on delete set null
    `)

    await queryRunner.query(
      `create index if not exists media_files_folder_id_idx on media_files (folder_id)`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop index if exists media_files_folder_id_idx`)
    await queryRunner.query(`alter table media_files drop column if exists folder_id`)
    await queryRunner.query(`drop table if exists media_folders`)
    await queryRunner.query(`alter table if exists media_files rename to media_titles`)
  }
}
