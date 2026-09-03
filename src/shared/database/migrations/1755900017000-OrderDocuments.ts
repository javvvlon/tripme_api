import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class OrderDocuments1755900017000 implements MigrationInterface {
  name = 'OrderDocuments1755900017000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists order_documents (
        id         uuid primary key default gen_random_uuid(),
        order_id   uuid        not null references orders (id) on delete cascade,
        kind       text        not null,
        name       text        not null,
        path       text        not null,
        url        text        not null,
        size       int         not null default 0,
        created_by uuid,
        created_at timestamptz not null default now()
      )
    `)

    await queryRunner.query(
      `create index if not exists order_documents_order_id_idx on order_documents (order_id)`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop index if exists order_documents_order_id_idx`)
    await queryRunner.query(`drop table if exists order_documents`)
  }
}
