import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class ReviewFields1755900047000 implements MigrationInterface {
  name = 'ReviewFields1755900047000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table content_items add column if not exists rating smallint`)
    await queryRunner.query(`alter table content_items drop constraint if exists content_items_rating_check`)
    await queryRunner.query(`alter table content_items add constraint content_items_rating_check check (rating between 1 and 5)`)
    await queryRunner.query(`alter table content_item_translations add column if not exists subtitle text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table content_item_translations drop column if exists subtitle`)
    await queryRunner.query(`alter table content_items drop constraint if exists content_items_rating_check`)
    await queryRunner.query(`alter table content_items drop column if exists rating`)
  }
}
