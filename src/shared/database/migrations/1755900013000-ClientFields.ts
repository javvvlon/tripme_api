import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class ClientFields1755900013000 implements MigrationInterface {
  name = 'ClientFields1755900013000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table leads
        add column if not exists channel         text not null default 'site',
        add column if not exists destination     text not null default '',
        add column if not exists planned_dates   text not null default '',
        add column if not exists party_size      int  not null default 0,
        add column if not exists budget_amount   numeric,
        add column if not exists budget_currency text not null default '',
        add column if not exists manager_id      uuid references users (id) on delete set null,
        add column if not exists reject_reason   text not null default ''
    `)

    await queryRunner.query(`
      alter table orders
        add column if not exists deal_date      date,
        add column if not exists traveller_name text not null default '',
        add column if not exists country        text not null default '',
        add column if not exists return_date    date,
        add column if not exists manager_id     uuid references users (id) on delete set null,
        add column if not exists branch         text not null default ''
    `)

    await queryRunner.query(`create index if not exists leads_manager_key on leads (manager_id)`)
    await queryRunner.query(`create index if not exists orders_manager_key on orders (manager_id)`)

    await queryRunner.query(`
      update leads set
        destination = coalesce(nullif(route_to, ''), ''),
        party_size  = greatest(adults + children, 0),
        channel     = case when source = 'manual' then 'manual' else 'site' end
      where destination = ''
    `)

    await queryRunner.query(`
      update orders o set
        traveller_name = trim(coalesce(l.first_name, '') || ' ' || coalesce(l.last_name, '')),
        return_date    = case when o.check_in is not null and o.nights > 0
                              then o.check_in + (o.nights || ' days')::interval
                         end
      from leads l
      where l.id = o.lead_id and o.traveller_name = ''
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table orders
        drop column if exists branch,
        drop column if exists manager_id,
        drop column if exists return_date,
        drop column if exists country,
        drop column if exists traveller_name,
        drop column if exists deal_date
    `)

    await queryRunner.query(`
      alter table leads
        drop column if exists reject_reason,
        drop column if exists manager_id,
        drop column if exists budget_currency,
        drop column if exists budget_amount,
        drop column if exists party_size,
        drop column if exists planned_dates,
        drop column if exists destination,
        drop column if exists channel
    `)
  }
}
