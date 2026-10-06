import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class HomeBlocks1755900027000 implements MigrationInterface {
  name = 'HomeBlocks1755900027000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const existing = await queryRunner.query(`select count(*)::int as n from content_sections where page = 'home' and kind in ('search', 'contact')`)

    if (existing[0].n > 0) return

    const banner = await queryRunner.query(`select id from content_banners where page = 'home' limit 1`)
    const translations: Array<{ locale: string, title: string, subtitle: string | null, image_url: string | null }> = banner.length
      ? await queryRunner.query(`select locale, title, subtitle, image_url from content_banner_translations where banner_id = $1`, [banner[0].id])
      : []
    const image = translations.find(t => t.image_url)?.image_url ?? null

    await queryRunner.query(`update content_sections set position = position + 1 where page = 'home'`)

    const [search] = await queryRunner.query(
      `insert into content_sections (page, kind, source, settings, position, is_published) values ('home', 'search', 'none', $1, 0, true) returning id`,
      [JSON.stringify({ image_url: image })],
    )

    for (const t of translations.filter(t => t.title?.trim() || t.subtitle?.trim())) {
      await queryRunner.query(
        `insert into content_section_translations (section_id, locale, title, subtitle) values ($1, $2, $3, $4)`,
        [search.id, t.locale, t.title ?? '', t.subtitle],
      )
    }

    const last = await queryRunner.query(`select coalesce(max(position), 0)::int as n from content_sections where page = 'home'`)

    await queryRunner.query(
      `insert into content_sections (page, kind, source, settings, position, is_published) values ('home', 'contact', 'none', '{}'::jsonb, $1, true)`,
      [last[0].n + 1],
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`delete from content_sections where page = 'home' and kind in ('search', 'contact')`)
  }
}
