import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class MarketingTemplates1755900050000 implements MigrationInterface {
  name = 'MarketingTemplates1755900050000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table marketing_selections add column if not exists template jsonb`)
    await queryRunner.query(`alter table marketing_selections add column if not exists template_drafts jsonb not null default '[]'`)
    await queryRunner.query(`alter table marketing_settings add column if not exists visual text not null default ''`)
    await queryRunner.query(`
      create table if not exists marketing_templates (
        id uuid primary key default gen_random_uuid(),
        name text not null,
        spec jsonb not null,
        created_by uuid references users(id) on delete set null,
        created_at timestamptz not null default now(),
        archived_at timestamptz,
        archived_by uuid references users(id) on delete set null
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists marketing_templates`)
    await queryRunner.query(`alter table marketing_settings drop column if exists visual`)
    await queryRunner.query(`alter table marketing_selections drop column if exists template_drafts`)
    await queryRunner.query(`alter table marketing_selections drop column if exists template`)
  }
}
