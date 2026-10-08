import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class OrderItems1755900030000 implements MigrationInterface {
  name = 'OrderItems1755900030000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists order_items (
        id uuid primary key default gen_random_uuid(),
        order_id uuid not null references orders(id) on delete cascade,
        position int not null default 0,
        kind text not null,
        status text not null,
        title text not null default '',
        supplier_name text not null default '',
        supplier_ref text not null default '',
        offer_id text not null default '',
        service_start date,
        service_end date,
        price_amount numeric,
        price_currency text not null default '',
        cost_amount numeric,
        cost_currency text not null default '',
        required_for_confirmation boolean not null default false,
        details jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `)
    await queryRunner.query(`create index if not exists order_items_order_id_idx on order_items (order_id)`)

    await queryRunner.query(`
      insert into order_items (
        order_id, position, kind, status, title, supplier_name, supplier_ref, offer_id,
        service_start, service_end, price_amount, price_currency, required_for_confirmation, details,
        created_at, updated_at
      )
      select
        o.id, 0, 'package',
        case o.status
          when 'requested' then 'requested'
          when 'confirmed' then 'confirmed'
          when 'paid' then 'confirmed'
          when 'issued' then 'issued'
          when 'travelling' then 'issued'
          when 'completed' then 'issued'
          when 'cancelled' then 'cancelled'
          else 'draft'
        end,
        coalesce(o.hotel_name, ''),
        coalesce(o.supplier_name, ''),
        coalesce(o.supplier_order_id, ''),
        coalesce(o.trip->>'offer_id', ''),
        o.check_in,
        coalesce(o.return_date, o.check_in + coalesce(o.nights, 0)),
        o.price_amount,
        coalesce(o.price_currency, ''),
        true,
        jsonb_build_object(
          'nights', coalesce(o.nights, 0),
          'adults', coalesce(o.adults, 0),
          'children', coalesce(o.children, 0),
          'country', coalesce(o.country, '')
        ) || jsonb_strip_nulls(jsonb_build_object(
          'hotel_stars', o.trip->'hotel_stars',
          'hotel_code', o.trip->'hotel_code',
          'meal_name', nullif(o.trip->>'meal_name', ''),
          'room_name', nullif(o.trip->>'room_name', ''),
          'district', nullif(o.trip->>'district', ''),
          'programme', nullif(o.trip->>'programme', ''),
          'fare', nullif(o.trip->>'fare', ''),
          'booking_url', nullif(o.trip->>'booking_url', ''),
          'hotel_url', nullif(o.trip->>'hotel_url', ''),
          'route_from', nullif(o.trip->>'route_from', ''),
          'route_to', nullif(o.trip->>'route_to', ''),
          'kid_ages', o.trip->'kid_ages'
        )),
        o.created_at,
        o.updated_at
      from orders o
      where not exists (select 1 from order_items i where i.order_id = o.id and i.kind = 'package')
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists order_items`)
  }
}
