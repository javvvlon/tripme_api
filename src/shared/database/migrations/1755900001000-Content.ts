import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class Content1755900001000 implements MigrationInterface {
  name = 'Content1755900001000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists content_layouts (
        id         uuid primary key default gen_random_uuid(),
        grid       text        not null,
        name       text,
        created_at timestamptz not null default now()
      )
    `)

    await queryRunner.query(`
      create table if not exists content_lists (
        id         uuid primary key default gen_random_uuid(),
        name       text        not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `)

    await queryRunner.query(`
      create table if not exists content_items (
        id        uuid primary key default gen_random_uuid(),
        list_id   uuid not null references content_lists (id) on delete cascade,
        image_url text,
        link      text,
        position  int  not null default 0
      )
    `)

    await queryRunner.query(`create index if not exists content_items_list_id_idx on content_items (list_id)`)

    await queryRunner.query(`
      create table if not exists content_item_translations (
        id          uuid primary key default gen_random_uuid(),
        item_id     uuid not null references content_items (id) on delete cascade,
        locale      text not null,
        title       text not null,
        description text
      )
    `)

    await queryRunner.query(`
      create unique index if not exists content_item_translations_key
        on content_item_translations (item_id, locale)
    `)

    await queryRunner.query(`
      create table if not exists content_sections (
        id           uuid primary key default gen_random_uuid(),
        page         text not null default 'home',
        link         text,
        list_id      uuid not null references content_lists (id)   on delete restrict,
        layout_id    uuid not null references content_layouts (id) on delete restrict,
        position     int  not null default 0,
        is_published boolean not null default true,
        updated_at   timestamptz not null default now()
      )
    `)

    await queryRunner.query(`create index if not exists content_sections_page_idx on content_sections (page)`)

    await queryRunner.query(`
      create table if not exists content_section_translations (
        id         uuid primary key default gen_random_uuid(),
        section_id uuid not null references content_sections (id) on delete cascade,
        locale     text not null,
        title      text not null
      )
    `)

    await queryRunner.query(`
      create unique index if not exists content_section_translations_key
        on content_section_translations (section_id, locale)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists content_section_translations`)
    await queryRunner.query(`drop table if exists content_sections`)
    await queryRunner.query(`drop table if exists content_item_translations`)
    await queryRunner.query(`drop table if exists content_items`)
    await queryRunner.query(`drop table if exists content_lists`)
    await queryRunner.query(`drop table if exists content_layouts`)
  }
}
