import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class ItemBadges1755900002000 implements MigrationInterface {
  name = 'ItemBadges1755900002000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table content_items add column if not exists badge_type text`)
    await queryRunner.query(`alter table content_item_translations add column if not exists badge_label text`)

    await queryRunner.query(`
      alter table content_items
        add constraint content_items_badge_type_check
        check (badge_type is null or badge_type in ('primary', 'secondary', 'sale'))
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table content_items drop constraint if exists content_items_badge_type_check`)
    await queryRunner.query(`alter table content_item_translations drop column if exists badge_label`)
    await queryRunner.query(`alter table content_items drop column if exists badge_type`)
  }
}
