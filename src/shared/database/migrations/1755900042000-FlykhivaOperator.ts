import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class FlykhivaOperator1755900042000 implements MigrationInterface {
  name = 'FlykhivaOperator1755900042000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      insert into operators (slug, name, connection, site_url, position)
      values ('flykhiva', 'Fly Khiva', 'mirror', 'https://b2b.flykhiva.travel', 6)
      on conflict (slug) do nothing
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`delete from operators where slug = 'flykhiva'`)
  }
}
