import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class Archive1755900035000 implements MigrationInterface {
  name = 'Archive1755900035000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['leads', 'orders']) {
      await queryRunner.query(`alter table ${table} add column if not exists archived_at timestamptz`)
      await queryRunner.query(`alter table ${table} add column if not exists archived_by uuid references users(id) on delete set null`)
      await queryRunner.query(`create index if not exists ${table}_archived_at_idx on ${table} (archived_at) where archived_at is not null`)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['leads', 'orders']) {
      await queryRunner.query(`drop index if exists ${table}_archived_at_idx`)
      await queryRunner.query(`alter table ${table} drop column if exists archived_by`)
      await queryRunner.query(`alter table ${table} drop column if exists archived_at`)
    }
  }
}
