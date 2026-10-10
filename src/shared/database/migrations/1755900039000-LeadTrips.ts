import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class LeadTrips1755900039000 implements MigrationInterface {
  name = 'LeadTrips1755900039000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table leads add column if not exists trip_no integer not null default 1`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table leads drop column if exists trip_no`)
  }
}
