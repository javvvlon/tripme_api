import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class LeadUser1755900018000 implements MigrationInterface {
  name = 'LeadUser1755900018000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table leads
      add column if not exists user_id uuid references users (id) on delete set null
    `)

    await queryRunner.query(`create index if not exists leads_user_id_idx on leads (user_id)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop index if exists leads_user_id_idx`)
    await queryRunner.query(`alter table leads drop column if exists user_id`)
  }
}
