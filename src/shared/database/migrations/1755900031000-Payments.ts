import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class Payments1755900031000 implements MigrationInterface {
  name = 'Payments1755900031000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists order_payments (
        id uuid primary key default gen_random_uuid(),
        order_id uuid not null references orders(id) on delete restrict,
        item_id uuid references order_items(id) on delete set null,
        direction text not null,
        amount numeric not null,
        currency text not null,
        fx_rate numeric not null,
        fx_date date not null,
        amount_uzs numeric not null,
        method text not null,
        paid_at date not null,
        receipt_document_id uuid references order_documents(id) on delete set null,
        reverses_payment_id uuid references order_payments(id) on delete restrict,
        note text not null default '',
        recorded_by uuid references users(id) on delete set null,
        created_at timestamptz not null default now()
      )
    `)
    await queryRunner.query(`create index if not exists order_payments_order_id_idx on order_payments (order_id)`)
    await queryRunner.query(`create unique index if not exists order_payments_reverses_idx on order_payments (reverses_payment_id) where reverses_payment_id is not null`)

    await queryRunner.query(`alter table orders add column if not exists deposit_percent int`)
    await queryRunner.query(`alter table order_items add column if not exists fx_rate numeric`)
    await queryRunner.query(`alter table order_items add column if not exists fx_date date`)
    await queryRunner.query(`
      update order_items set fx_rate = 1, fx_date = coalesce(fx_date, created_at::date)
      where fx_rate is null and (price_currency = '' or price_currency = 'UZS')
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists order_payments`)
    await queryRunner.query(`alter table order_items drop column if exists fx_date`)
    await queryRunner.query(`alter table order_items drop column if exists fx_rate`)
    await queryRunner.query(`alter table orders drop column if exists deposit_percent`)
  }
}
