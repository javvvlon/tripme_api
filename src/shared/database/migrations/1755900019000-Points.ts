import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class Points1755900019000 implements MigrationInterface {
  name = 'Points1755900019000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists points_tiers (
        id uuid primary key default gen_random_uuid(),
        name text not null,
        threshold int not null,
        discount_percent numeric(5, 2) not null,
        updated_at timestamptz not null default now()
      )
    `)

    await queryRunner.query(`
      create table if not exists points_settings (
        id int primary key,
        rates jsonb not null default '{}'::jsonb,
        updated_at timestamptz not null default now()
      )
    `)

    await queryRunner.query(`
      create table if not exists points_transactions (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users (id) on delete cascade,
        delta int not null,
        reason text not null,
        order_id uuid references orders (id) on delete set null,
        note text not null default '',
        actor_id uuid references users (id) on delete set null,
        created_at timestamptz not null default now()
      )
    `)

    await queryRunner.query(`create index if not exists points_transactions_user_id_idx on points_transactions (user_id)`)

    await queryRunner.query(`
      create unique index if not exists points_transactions_order_once_idx
      on points_transactions (order_id) where reason = 'order'
    `)

    await queryRunner.query(`
      insert into points_settings (id, rates)
      values (1, '{"USD": 10, "EUR": 11, "UZS": 0.0008}'::jsonb)
      on conflict (id) do nothing
    `)

    await queryRunner.query(`
      insert into points_tiers (name, threshold, discount_percent)
      select * from (values
        ('Silver', 5000, 3.00),
        ('Gold', 10000, 5.00),
        ('Platinum', 25000, 8.00)
      ) as seed (name, threshold, discount_percent)
      where not exists (select 1 from points_tiers)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists points_transactions`)
    await queryRunner.query(`drop table if exists points_settings`)
    await queryRunner.query(`drop table if exists points_tiers`)
  }
}
