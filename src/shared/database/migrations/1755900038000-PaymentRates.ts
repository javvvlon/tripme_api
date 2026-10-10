import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class PaymentRates1755900038000 implements MigrationInterface {
  name = 'PaymentRates1755900038000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table order_payments add column if not exists rates jsonb`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table order_payments drop column if exists rates`)
  }
}
