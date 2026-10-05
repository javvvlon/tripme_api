import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class DropSectionVariant1755900023000 implements MigrationInterface {
  name = 'DropSectionVariant1755900023000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`update content_sections set layout_id = null where kind <> 'cards'`)
    await queryRunner.query(`update content_sections set link = null where kind <> 'cards'`)
    await queryRunner.query(`alter table content_sections drop column if exists variant`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table content_sections add column if not exists variant text not null default 'list'`)
    await queryRunner.query(`
      update content_sections set variant = case when kind = 'cards' then source else kind end
    `)
  }
}
