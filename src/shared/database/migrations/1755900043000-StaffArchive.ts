import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class StaffArchive1755900043000 implements MigrationInterface {
  name = 'StaffArchive1755900043000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table users add column if not exists archived_at timestamptz`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table users drop column if exists archived_at`)
  }
}
