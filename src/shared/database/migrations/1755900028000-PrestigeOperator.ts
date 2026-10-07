import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class PrestigeOperator1755900028000 implements MigrationInterface {
  name = 'PrestigeOperator1755900028000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      insert into operators (slug, name, connection, site_url, position)
      values ('prestige', 'Prestige', 'mirror', 'https://online.uz-prestige.com', 5)
      on conflict (slug) do nothing
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`delete from operators where slug = 'prestige'`)
  }
}
