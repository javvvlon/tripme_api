import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class MarketingOwnOffers1755900052000 implements MigrationInterface {
  name = 'MarketingOwnOffers1755900052000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table marketing_selections add column if not exists includes jsonb not null default '[]'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table marketing_selections drop column if exists includes`)
  }
}
