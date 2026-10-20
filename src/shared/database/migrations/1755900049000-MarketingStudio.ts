import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class MarketingStudio1755900049000 implements MigrationInterface {
  name = 'MarketingStudio1755900049000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table marketing_selections add column if not exists variants jsonb not null default '{}'`)
    await queryRunner.query(`alter table marketing_selections add column if not exists design jsonb not null default '{}'`)
    await queryRunner.query(`alter table marketing_selections add column if not exists contacts jsonb not null default '[]'`)
    await queryRunner.query(`alter table marketing_selections add column if not exists backgrounds jsonb not null default '[]'`)
    await queryRunner.query(`alter table marketing_selections add column if not exists published jsonb not null default '[]'`)
    await queryRunner.query(`
      create table if not exists marketing_settings (
        id smallint primary key default 1 check (id = 1),
        voice text not null default '',
        footer text not null default '',
        contacts jsonb not null default '[]',
        updated_at timestamptz not null default now(),
        updated_by uuid references users(id) on delete set null
      )
    `)
    await queryRunner.query(`alter table marketing_settings add column if not exists footer text not null default ''`)
    await queryRunner.query(`alter table marketing_settings add column if not exists footer_uz text not null default ''`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists marketing_settings`)

    for (const column of ['published', 'backgrounds', 'contacts', 'design', 'variants']) {
      await queryRunner.query(`alter table marketing_selections drop column if exists ${column}`)
    }
  }
}
