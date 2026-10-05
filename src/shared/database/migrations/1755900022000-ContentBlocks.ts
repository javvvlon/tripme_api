import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class ContentBlocks1755900022000 implements MigrationInterface {
  name = 'ContentBlocks1755900022000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table content_lists add column if not exists kind text not null default 'cards'`)
    await queryRunner.query(`
      alter table content_sections
        add column if not exists kind text not null default 'cards',
        add column if not exists source text not null default 'list',
        add column if not exists anchor text,
        alter column layout_id drop not null
    `)
    await queryRunner.query(`
      update content_sections set
        kind = case when variant in ('features', 'faq') then variant else 'cards' end,
        source = case when variant = 'posts' then 'posts' else 'list' end
    `)
    await queryRunner.query(`
      update content_lists list set kind = section.kind
      from content_sections section
      where section.list_id = list.id and section.kind <> 'cards'
    `)
    await queryRunner.query(`
      update content_sections set anchor = 'hot'
      where id in (
        select distinct on (page) id from content_sections
        where kind = 'cards' and source = 'list'
        order by page, position
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      update content_sections set layout_id = (select id from content_layouts order by grid limit 1)
      where layout_id is null
    `)
    await queryRunner.query(`
      alter table content_sections
        drop column if exists kind,
        drop column if exists source,
        drop column if exists anchor,
        alter column layout_id set not null
    `)
    await queryRunner.query(`alter table content_lists drop column if exists kind`)
  }
}
