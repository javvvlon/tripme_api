import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class Leads1755900008000 implements MigrationInterface {
  name = 'Leads1755900008000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists leads (
        id             uuid primary key default gen_random_uuid(),
        status         text        not null default 'new',
        first_name     text        not null,
        last_name      text        not null default '',
        phone          text        not null,
        comment        text        not null default '',
        locale         text        not null default 'ru',
        hotel_name     text        not null default '',
        supplier_name  text        not null default '',
        check_in       date,
        nights         int         not null default 0,
        adults         int         not null default 0,
        children       int         not null default 0,
        price_amount   numeric,
        price_currency text        not null default '',
        route_from     text        not null default '',
        route_to       text        not null default '',
        trip           jsonb       not null default '{}',
        created_at     timestamptz not null default now(),
        updated_at     timestamptz not null default now()
      )
    `)

    await queryRunner.query(`create index if not exists leads_status_key on leads (status)`)
    await queryRunner.query(`create index if not exists leads_created_key on leads (created_at desc)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists leads`)
  }
}
