import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class MarketingSelections1755900048000 implements MigrationInterface {
  name = 'MarketingSelections1755900048000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists marketing_selections (
        id uuid primary key default gen_random_uuid(),
        code text not null,
        title text not null default '',
        tours jsonb not null default '[]',
        copy jsonb not null default '{}',
        style text not null default 'classic',
        background jsonb,
        checked_at timestamptz,
        created_by uuid references users(id) on delete set null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        archived_at timestamptz,
        archived_by uuid references users(id) on delete set null
      )
    `)
    await queryRunner.query(`create unique index if not exists marketing_selections_code_key on marketing_selections (code)`)
    await queryRunner.query(`create index if not exists marketing_selections_created_at_idx on marketing_selections (created_at desc)`)
    await queryRunner.query(`create index if not exists leads_campaign_idx on leads ((trip->>'campaign'))`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop index if exists leads_campaign_idx`)
    await queryRunner.query(`drop table if exists marketing_selections`)
  }
}
