import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class EsimPurchases1755900033000 implements MigrationInterface {
  name = 'EsimPurchases1755900033000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists esim_purchases (
        id uuid primary key default gen_random_uuid(),
        number bigserial not null,
        token text not null,
        status text not null,
        country text not null,
        plan_id text not null,
        plan jsonb not null,
        provider text not null,
        wholesale_usd numeric not null,
        fx_rate numeric not null,
        margin_percent numeric not null,
        price_uzs bigint not null,
        email text not null,
        phone text not null,
        locale text not null default 'ru',
        payment_method text not null,
        payment_txn text,
        payment_state int,
        payment_created_ms bigint,
        payment_performed_ms bigint,
        payment_cancelled_ms bigint,
        payment_cancel_reason int,
        paid_at timestamptz,
        esim jsonb,
        issue_error text not null default '',
        issue_attempts int not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `)
    await queryRunner.query(`alter sequence esim_purchases_number_seq restart with 1001`)
    await queryRunner.query(`create unique index if not exists esim_purchases_token_idx on esim_purchases (token)`)
    await queryRunner.query(`create unique index if not exists esim_purchases_number_idx on esim_purchases (number)`)
    await queryRunner.query(`create index if not exists esim_purchases_status_idx on esim_purchases (status)`)
    await queryRunner.query(`create unique index if not exists esim_purchases_txn_idx on esim_purchases (payment_method, payment_txn) where payment_txn is not null`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists esim_purchases`)
  }
}
