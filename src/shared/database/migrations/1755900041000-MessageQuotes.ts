import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class MessageQuotes1755900041000 implements MigrationInterface {
  name = 'MessageQuotes1755900041000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table messages add column if not exists kind text not null default 'text'`)
    await queryRunner.query(`alter table messages add column if not exists data jsonb`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table messages drop column if exists data`)
    await queryRunner.query(`alter table messages drop column if exists kind`)
  }
}
