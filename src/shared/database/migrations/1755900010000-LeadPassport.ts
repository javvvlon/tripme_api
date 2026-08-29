import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class LeadPassport1755900010000 implements MigrationInterface {
  name = 'LeadPassport1755900010000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table leads
        add column if not exists passport_id text not null default '',
        add column if not exists passport_expires_at date
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table leads
        drop column if exists passport_expires_at,
        drop column if exists passport_id
    `)
  }
}
