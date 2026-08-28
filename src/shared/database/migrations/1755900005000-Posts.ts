import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class Posts1755900005000 implements MigrationInterface {
  name = 'Posts1755900005000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists posts (
        id           uuid primary key default gen_random_uuid(),
        slug         text        not null,
        image_url    text,
        badge_type   text,
        link         text,
        is_published boolean     not null default false,
        published_at timestamptz,
        created_at   timestamptz not null default now(),
        updated_at   timestamptz not null default now()
      )
    `)

    await queryRunner.query(`
      create unique index if not exists posts_slug_key on posts (slug)
    `)

    await queryRunner.query(`
      create index if not exists posts_published_key on posts (is_published, published_at desc)
    `)

    await queryRunner.query(`
      create table if not exists post_translations (
        id          uuid primary key default gen_random_uuid(),
        post_id     uuid not null references posts (id) on delete cascade,
        locale      text not null,
        title       text not null default '',
        excerpt     text not null default '',
        body        text not null default '',
        badge_label text
      )
    `)

    await queryRunner.query(`
      create unique index if not exists post_translations_key
        on post_translations (post_id, locale)
    `)

    await queryRunner.query(`
      alter table content_sections
        add column if not exists variant text not null default 'list'
    `)

    await queryRunner.query(`
      alter table content_sections
        alter column list_id drop not null
    `)

    await queryRunner.query(`
      create table if not exists contact_messages (
        id         uuid primary key default gen_random_uuid(),
        first_name text        not null,
        last_name  text        not null default '',
        phone      text        not null,
        message    text        not null default '',
        created_at timestamptz not null default now()
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists contact_messages`)
    await queryRunner.query(`alter table content_sections drop column if exists variant`)
    await queryRunner.query(`drop table if exists post_translations`)
    await queryRunner.query(`drop table if exists posts`)
  }
}
