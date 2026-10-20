import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class MarketingIntake1755900051000 implements MigrationInterface {
  name = 'MarketingIntake1755900051000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table marketing_selections add column if not exists intake jsonb`)
    await queryRunner.query(`
      create table if not exists marketing_bot_links (
        telegram_id bigint primary key,
        user_id uuid not null references users(id) on delete cascade,
        username text not null default '',
        linked_at timestamptz not null default now(),
        archived_at timestamptz
      )
    `)
    await queryRunner.query(`create index if not exists marketing_bot_links_user on marketing_bot_links (user_id) where archived_at is null`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists marketing_bot_links`)
    await queryRunner.query(`alter table marketing_selections drop column if exists intake`)
  }
}
