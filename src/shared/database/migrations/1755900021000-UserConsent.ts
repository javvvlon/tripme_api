import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class UserConsent1755900021000 implements MigrationInterface {
  name = 'UserConsent1755900021000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table users add column if not exists consent_at timestamptz`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table users drop column if exists consent_at`)
  }
}
