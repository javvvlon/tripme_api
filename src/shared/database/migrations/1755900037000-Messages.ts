import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class Messages1755900037000 implements MigrationInterface {
  name = 'Messages1755900037000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists conversations (
        client_id uuid primary key references users(id) on delete cascade,
        last_message_at timestamptz,
        client_read_at timestamptz,
        staff_read_at timestamptz,
        created_at timestamptz not null default now()
      )
    `)
    await queryRunner.query(`
      create table if not exists messages (
        id uuid primary key default gen_random_uuid(),
        client_id uuid not null references conversations(client_id) on delete cascade,
        author_id uuid references users(id) on delete set null,
        author_role text not null,
        body text not null,
        order_id uuid references orders(id) on delete set null,
        created_at timestamptz not null default now()
      )
    `)
    await queryRunner.query(`create index if not exists messages_client_created_idx on messages (client_id, created_at)`)
    await queryRunner.query(`create index if not exists conversations_last_message_idx on conversations (last_message_at desc)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists messages`)
    await queryRunner.query(`drop table if exists conversations`)
  }
}
