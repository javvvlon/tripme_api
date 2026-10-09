import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class LeadCustomerLink1755900034000 implements MigrationInterface {
  name = 'LeadCustomerLink1755900034000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      update leads set user_id = null
      where user_id is not null
        and user_id not in (select id from users where role = 'CLIENT')
    `)
  }

  public async down(): Promise<void> {
    return undefined
  }
}
