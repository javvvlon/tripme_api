import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class Auth1755900000000 implements MigrationInterface {
  name = 'Auth1755900000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`create extension if not exists "pgcrypto"`)

    await queryRunner.query(`
      create table if not exists users (
        id            uuid primary key default gen_random_uuid(),
        email         text        not null,
        password_hash text        not null,
        first_name    text        not null default '',
        last_name     text        not null default '',
        phone_number  text        not null default '',
        role          text        not null default 'CLIENT',
        is_verified   boolean     not null default false,
        created_at    timestamptz not null default now(),
        updated_at    timestamptz not null default now()
      )
    `)

    await queryRunner.query(`create unique index if not exists users_email_key on users (email)`)

    await queryRunner.query(`
      create table if not exists sessions (
        id         uuid primary key default gen_random_uuid(),
        user_id    uuid        not null references users (id) on delete cascade,
        token_hash text        not null,
        expires_at timestamptz not null,
        revoked_at timestamptz,
        user_agent text,
        ip         text,
        created_at timestamptz not null default now()
      )
    `)

    await queryRunner.query(`create unique index if not exists sessions_token_hash_key on sessions (token_hash)`)
    await queryRunner.query(`create index if not exists sessions_user_id_idx on sessions (user_id)`)
    await queryRunner.query(`create index if not exists sessions_expires_at_idx on sessions (expires_at)`)

    await queryRunner.query(`
      create table if not exists verification_codes (
        id          uuid primary key default gen_random_uuid(),
        user_id     uuid        not null references users (id) on delete cascade,
        code_hash   text        not null,
        expires_at  timestamptz not null,
        consumed_at timestamptz,
        created_at  timestamptz not null default now()
      )
    `)

    await queryRunner.query(`create index if not exists verification_codes_user_id_idx on verification_codes (user_id)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists verification_codes`)
    await queryRunner.query(`drop table if exists sessions`)
    await queryRunner.query(`drop table if exists users`)
  }
}
