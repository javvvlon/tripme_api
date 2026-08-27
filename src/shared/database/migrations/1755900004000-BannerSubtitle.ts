import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class BannerSubtitle1755900004000 implements MigrationInterface {
  name = 'BannerSubtitle1755900004000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table content_banner_translations add column if not exists subtitle text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table content_banner_translations drop column if exists subtitle`)
  }
}
