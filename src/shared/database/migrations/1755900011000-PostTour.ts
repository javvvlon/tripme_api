import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class PostTour1755900011000 implements MigrationInterface {
  name = 'PostTour1755900011000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table posts add column if not exists tour jsonb`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table posts drop column if exists tour`)
  }
}
