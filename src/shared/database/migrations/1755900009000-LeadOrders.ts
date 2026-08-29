import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class LeadOrders1755900009000 implements MigrationInterface {
  name = 'LeadOrders1755900009000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`create sequence if not exists leads_order_id_seq start 1001`)

    await queryRunner.query(`
      alter table leads
        add column if not exists order_id bigint not null default nextval('leads_order_id_seq')
    `)

    await queryRunner.query(`
      alter table leads
        add column if not exists supplier_order_id text not null default ''
    `)

    await queryRunner.query(`
      alter table leads
        add column if not exists source text not null default 'site'
    `)

    await queryRunner.query(`
      create unique index if not exists leads_order_id_key on leads (order_id)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop index if exists leads_order_id_key`)
    await queryRunner.query(`alter table leads drop column if exists source`)
    await queryRunner.query(`alter table leads drop column if exists supplier_order_id`)
    await queryRunner.query(`alter table leads drop column if exists order_id`)
    await queryRunner.query(`drop sequence if exists leads_order_id_seq`)
  }
}
