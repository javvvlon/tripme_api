import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const BLOG_HERO: Record<string, [string, string]> = {
  ru: ['Блог TripMe', 'Направления, маршруты и практические советы — от людей, которые отправляют туда туристов каждый день.'],
  uz: ['TripMe blogi', 'Yo‘nalishlar, marshrutlar va amaliy maslahatlar — har kuni u yerga sayohatchilarni jo‘natadigan odamlardan.'],
  en: ['The TripMe blog', 'Destinations, routes and practical advice — from the people who send travellers there every day.'],
}

const BLOG_SEO: Record<string, { title: string, description: string }> = {
  ru: { title: 'Блог — TripMe', description: BLOG_HERO.ru![1] },
  uz: { title: 'Blog — TripMe', description: BLOG_HERO.uz![1] },
  en: { title: 'Blog — TripMe', description: BLOG_HERO.en![1] },
}

export class PageBuilder1755900025000 implements MigrationInterface {
  name = 'PageBuilder1755900025000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table content_sections add column if not exists settings jsonb not null default '{}'::jsonb`)
    await queryRunner.query(`alter table content_section_translations add column if not exists subtitle text`)
    await queryRunner.query(`
      create table if not exists content_pages (
        page text primary key,
        seo jsonb not null default '{}'::jsonb,
        updated_at timestamptz not null default now()
      )
    `)

    const existing = await queryRunner.query(`select count(*)::int as n from content_sections where page = 'blog'`)

    if (existing[0].n > 0) return

    const blocks: Array<{ kind: string, source: string, settings: object, titles: Record<string, [string, string | null]> }> = [
      {
        kind: 'hero',
        source: 'none',
        settings: { image_url: null },
        titles: Object.fromEntries(Object.entries(BLOG_HERO).map(([locale, [title, lead]]) => [locale, [title, lead]])),
      },
      { kind: 'featured', source: 'posts', settings: {}, titles: {} },
      { kind: 'feed', source: 'posts', settings: { page_size: 9, exclude_featured: true }, titles: {} },
    ]

    for (const [index, block] of blocks.entries()) {
      const [row] = await queryRunner.query(
        `insert into content_sections (page, kind, source, settings, position, is_published, post_ids)
         values ('blog', $1, $2, $3::jsonb, $4, true, '{}') returning id`,
        [block.kind, block.source, JSON.stringify(block.settings), index + 1],
      )

      for (const [locale, [title, subtitle]] of Object.entries(block.titles)) {
        await queryRunner.query(
          `insert into content_section_translations (section_id, locale, title, subtitle) values ($1, $2, $3, $4)`,
          [row.id, locale, title, subtitle],
        )
      }
    }

    await queryRunner.query(
      `insert into content_pages (page, seo) values ('blog', $1::jsonb) on conflict (page) do nothing`,
      [JSON.stringify(BLOG_SEO)],
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`delete from content_sections where page = 'blog'`)
    await queryRunner.query(`drop table if exists content_pages`)
    await queryRunner.query(`alter table content_section_translations drop column if exists subtitle`)
    await queryRunner.query(`alter table content_sections drop column if exists settings`)
  }
}
