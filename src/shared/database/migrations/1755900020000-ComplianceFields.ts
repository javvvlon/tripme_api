import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class ComplianceFields1755900020000 implements MigrationInterface {
  name = 'ComplianceFields1755900020000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table leads add column if not exists first_response_at timestamptz`)
    await queryRunner.query(`alter table leads add column if not exists consent_at timestamptz`)
    await queryRunner.query(`alter table orders add column if not exists cancel_reason text not null default ''`)

    await queryRunner.query(`
      update leads set first_response_at = updated_at
      where first_response_at is null and status <> 'new'
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table orders drop column if exists cancel_reason`)
    await queryRunner.query(`alter table leads drop column if exists consent_at`)
    await queryRunner.query(`alter table leads drop column if exists first_response_at`)
  }
}
