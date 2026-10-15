import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class KazunionOperator1755900046000 implements MigrationInterface {
  name = 'KazunionOperator1755900046000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      insert into operators (slug, name, connection, site_url, position)
      values ('kazunion', 'Kazunion', 'mirror', 'https://online.kazunion.com', 11)
      on conflict (slug) do nothing
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`delete from operators where slug = 'kazunion'`)
  }
}
