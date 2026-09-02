import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class Orders1755900012000 implements MigrationInterface {
  name = 'Orders1755900012000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`create sequence if not exists orders_order_no_seq start 1001`)

    await queryRunner.query(`
      create table if not exists orders (
        id                  uuid primary key default gen_random_uuid(),
        order_no            bigint      not null default nextval('orders_order_no_seq'),
        lead_id             uuid        not null references leads (id) on delete cascade,
        status              text        not null default 'draft',
        supplier_order_id   text        not null default '',
        passport_id         text        not null default '',
        passport_expires_at date,
        hotel_name          text        not null default '',
        supplier_name       text        not null default '',
        check_in            date,
        nights              int         not null default 0,
        adults              int         not null default 0,
        children            int         not null default 0,
        price_amount        numeric,
        price_currency      text        not null default '',
        trip                jsonb       not null default '{}',
        note                text        not null default '',
        created_at          timestamptz not null default now(),
        updated_at          timestamptz not null default now()
      )
    `)

    await queryRunner.query(`create unique index if not exists orders_order_no_key on orders (order_no)`)
    await queryRunner.query(`create index if not exists orders_lead_key on orders (lead_id)`)
    await queryRunner.query(`create index if not exists orders_status_key on orders (status)`)

    await queryRunner.query(`
      create table if not exists order_events (
        id          uuid primary key default gen_random_uuid(),
        order_id    uuid        not null references orders (id) on delete cascade,
        from_status text,
        to_status   text        not null,
        actor_id    uuid references users (id) on delete set null,
        created_at  timestamptz not null default now()
      )
    `)

    await queryRunner.query(`create index if not exists order_events_order_key on order_events (order_id)`)

    await queryRunner.query(`
      insert into orders (
        order_no, lead_id, status, supplier_order_id, passport_id, passport_expires_at,
        hotel_name, supplier_name, check_in, nights, adults, children,
        price_amount, price_currency, trip, created_at, updated_at
      )
      select
        l.order_id,
        l.id,
        case when l.status = 'booked' then 'confirmed' else 'draft' end,
        l.supplier_order_id, l.passport_id, l.passport_expires_at,
        l.hotel_name, l.supplier_name, l.check_in, l.nights, l.adults, l.children,
        l.price_amount, l.price_currency, l.trip, l.created_at, l.updated_at
      from leads l
    `)

    await queryRunner.query(`
      select setval('orders_order_no_seq', greatest((select coalesce(max(order_no), 1000) from orders), 1000))
    `)

    await queryRunner.query(`
      insert into order_events (order_id, from_status, to_status, created_at)
      select o.id, null, o.status, o.created_at from orders o
    `)

    await queryRunner.query(`update leads set status = 'won' where status = 'booked'`)

    await queryRunner.query(`
      alter table leads
        drop column if exists supplier_order_id,
        drop column if exists passport_id,
        drop column if exists passport_expires_at
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table leads
        add column if not exists supplier_order_id text not null default '',
        add column if not exists passport_id text not null default '',
        add column if not exists passport_expires_at date
    `)

    await queryRunner.query(`update leads set status = 'booked' where status = 'won'`)
    await queryRunner.query(`drop table if exists order_events`)
    await queryRunner.query(`drop table if exists orders`)
    await queryRunner.query(`drop sequence if exists orders_order_no_seq`)
  }
}
