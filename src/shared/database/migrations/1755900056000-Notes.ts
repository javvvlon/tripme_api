import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class Notes1755900056000 implements MigrationInterface {
  name = 'Notes1755900056000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists notes (
        id uuid primary key default gen_random_uuid(),
        kind text not null,
        kind_no int not null,
        title text not null,
        body text not null default '',
        rationale text not null default '',
        refs text[] not null default '{}',
        author_id uuid not null references users(id),
        supersedes_id uuid null references notes(id),
        archived_at timestamptz null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (kind, kind_no)
      )
    `)
    await queryRunner.query(`create index if not exists notes_author_idx on notes (author_id)`)
    await queryRunner.query(`create index if not exists notes_supersedes_idx on notes (supersedes_id)`)

    await queryRunner.query(`
      create table if not exists note_acks (
        id uuid primary key default gen_random_uuid(),
        note_id uuid not null references notes(id),
        user_id uuid not null references users(id),
        acknowledged_at timestamptz null,
        created_at timestamptz not null default now(),
        unique (note_id, user_id)
      )
    `)
    await queryRunner.query(`create index if not exists note_acks_user_idx on note_acks (user_id)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists note_acks`)
    await queryRunner.query(`drop table if exists notes`)
  }
}
