import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class Tasks1755900055000 implements MigrationInterface {
  name = 'Tasks1755900055000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists tasks (
        id uuid primary key default gen_random_uuid(),
        task_no bigserial not null unique,
        title text not null,
        description text not null default '',
        status text not null default 'todo',
        priority text not null default 'medium',
        assignee_id uuid null references users(id),
        author_id uuid not null references users(id),
        due_on date null,
        labels text[] not null default '{}',
        completed_at timestamptz null,
        archived_at timestamptz null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `)
    await queryRunner.query(`create index if not exists tasks_status_idx on tasks (status)`)
    await queryRunner.query(`create index if not exists tasks_assignee_idx on tasks (assignee_id)`)
    await queryRunner.query(`create index if not exists tasks_author_idx on tasks (author_id)`)

    await queryRunner.query(`
      create table if not exists task_events (
        id uuid primary key default gen_random_uuid(),
        task_id uuid not null references tasks(id),
        kind text not null,
        from_value text null,
        to_value text null,
        body text not null default '',
        actor_id uuid null references users(id),
        created_at timestamptz not null default now()
      )
    `)
    await queryRunner.query(`create index if not exists task_events_task_idx on task_events (task_id, created_at)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists task_events`)
    await queryRunner.query(`drop table if exists tasks`)
  }
}
