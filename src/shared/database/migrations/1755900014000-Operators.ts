import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class Operators1755900014000 implements MigrationInterface {
  name = 'Operators1755900014000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists operators (
        id           uuid primary key default gen_random_uuid(),
        slug         text        not null,
        name         text        not null,
        is_enabled   boolean     not null default true,
        connection   text        not null default 'mirror',
        site_url     text        not null default '',
        api_base_url text        not null default '',
        api_key      text        not null default '',
        api_secret   text        not null default '',
        api_login    text        not null default '',
        note         text        not null default '',
        position     int         not null default 0,
        updated_at   timestamptz not null default now()
      )
    `)

    await queryRunner.query(`create unique index if not exists operators_slug_key on operators (slug)`)

    await queryRunner.query(`
      insert into operators (slug, name, connection, site_url, position) values
        ('kompastour',   'Kompas Tour',   'mirror', 'https://online.uz.kompastour.com', 1),
        ('easybooking',  'EasyBooking',   'mirror', 'https://b2b.easybooking.uz',       2),
        ('selfietravel', 'Selfie Travel', 'mirror', 'https://b2b.selfietravel.uz',      3),
        ('fstravel',     'FUN&SUN Asia',  'mirror', 'https://b2b.fstravel.com',         4)
      on conflict (slug) do nothing
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists operators`)
  }
}
