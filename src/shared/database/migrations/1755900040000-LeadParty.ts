import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class LeadParty1755900040000 implements MigrationInterface {
  name = 'LeadParty1755900040000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table leads add column if not exists children_ages jsonb not null default '[]'::jsonb`)
    await queryRunner.query(`
      update leads set children_ages = trip->'kid_ages'
      where jsonb_typeof(trip->'kid_ages') = 'array' and children_ages = '[]'::jsonb
    `)
    await queryRunner.query(`
      update leads set adults = party_size
      where adults = 0 and children = 0 and party_size > 0
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table leads drop column if exists children_ages`)
  }
}
