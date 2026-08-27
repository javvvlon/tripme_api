import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class Banner1755900003000 implements MigrationInterface {
  name = 'Banner1755900003000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists content_banners (
        id         uuid primary key default gen_random_uuid(),
        page       text        not null default 'home',
        updated_at timestamptz not null default now()
      )
    `)

    await queryRunner.query(`
      create unique index if not exists content_banners_page_key on content_banners (page)
    `)

    await queryRunner.query(`
      create table if not exists content_banner_translations (
        id        uuid primary key default gen_random_uuid(),
        banner_id uuid not null references content_banners (id) on delete cascade,
        locale    text not null,
        title     text not null default '',
        image_url text
      )
    `)

    await queryRunner.query(`
      create unique index if not exists content_banner_translations_key
        on content_banner_translations (banner_id, locale)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists content_banner_translations`)
    await queryRunner.query(`drop table if exists content_banners`)
  }
}
