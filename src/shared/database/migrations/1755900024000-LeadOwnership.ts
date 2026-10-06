import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class LeadOwnership1755900024000 implements MigrationInterface {
  name = 'LeadOwnership1755900024000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists lead_events (
        id uuid primary key default gen_random_uuid(),
        lead_id uuid not null references leads(id) on delete cascade,
        kind text not null,
        from_value text,
        to_value text,
        subject text,
        actor_id uuid references users(id) on delete set null,
        created_at timestamptz not null default now()
      )
    `)
    await queryRunner.query(`create index if not exists lead_events_lead_id_idx on lead_events (lead_id)`)
    await queryRunner.query(`create index if not exists leads_manager_id_idx on leads (manager_id)`)
    await queryRunner.query(`create index if not exists orders_manager_id_idx on orders (manager_id)`)

    await queryRunner.query(`
      update orders o set manager_id = first_actor.actor_id
      from (
        select distinct on (e.order_id) e.order_id, e.actor_id
        from order_events e
        join users u on u.id = e.actor_id and u.role in ('AGENT', 'MANAGER', 'ADMIN')
        order by e.order_id, e.created_at
      ) first_actor
      where o.id = first_actor.order_id and o.manager_id is null
    `)
    await queryRunner.query(`
      update leads l set manager_id = first_order.manager_id
      from (
        select distinct on (lead_id) lead_id, manager_id
        from orders
        where manager_id is not null
        order by lead_id, created_at
      ) first_order
      where l.id = first_order.lead_id and l.manager_id is null
    `)
    await queryRunner.query(`
      update orders o set manager_id = l.manager_id
      from leads l
      where l.id = o.lead_id and o.manager_id is null and l.manager_id is not null
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop index if exists orders_manager_id_idx`)
    await queryRunner.query(`drop index if exists leads_manager_id_idx`)
    await queryRunner.query(`drop table if exists lead_events`)
  }
}
