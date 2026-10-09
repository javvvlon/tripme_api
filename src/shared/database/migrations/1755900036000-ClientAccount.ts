import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class ClientAccount1755900036000 implements MigrationInterface {
  name = 'ClientAccount1755900036000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table users add column if not exists phone_verified_at timestamptz`)
    await queryRunner.query(`alter table users add column if not exists deleted_at timestamptz`)
    await queryRunner.query(`alter table verification_codes add column if not exists purpose text not null default 'email'`)
    await queryRunner.query(`alter table verification_codes add column if not exists target text not null default ''`)
    await queryRunner.query(`
      create table if not exists travellers (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        first_name text not null default '',
        last_name text not null default '',
        birth_date date,
        gender text not null default '',
        citizenship text not null default '',
        passport_number text not null default '',
        passport_expires_at date,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `)
    await queryRunner.query(`create index if not exists travellers_user_id_idx on travellers (user_id)`)
    await queryRunner.query(`alter table esim_purchases add column if not exists user_id uuid references users(id) on delete set null`)
    await queryRunner.query(`create index if not exists esim_purchases_user_id_idx on esim_purchases (user_id) where user_id is not null`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop index if exists esim_purchases_user_id_idx`)
    await queryRunner.query(`alter table esim_purchases drop column if exists user_id`)
    await queryRunner.query(`drop table if exists travellers`)
    await queryRunner.query(`alter table verification_codes drop column if exists target`)
    await queryRunner.query(`alter table verification_codes drop column if exists purpose`)
    await queryRunner.query(`alter table users drop column if exists deleted_at`)
    await queryRunner.query(`alter table users drop column if exists phone_verified_at`)
  }
}
