import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const OPERATORS: Array<[string, string, string, number]> = [
  ['malva', 'Malva Tour', 'https://malvatouroperator.uz', 7],
  ['rightflight', 'Right Flight', 'https://online.right-flight.org', 8],
  ['aquatravel', 'Aqua Travel Plus', 'https://online.aquatravelplus.com', 9],
  ['crystalbay', 'Crystal Bay', 'https://booking.crystalbay.com', 10],
]

export class SamoOperators1755900045000 implements MigrationInterface {
  name = 'SamoOperators1755900045000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [slug, name, site, position] of OPERATORS) {
      await queryRunner.query(
        `insert into operators (slug, name, connection, site_url, position) values ($1, $2, 'mirror', $3, $4) on conflict (slug) do nothing`,
        [slug, name, site, position],
      )
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`delete from operators where slug = any($1)`, [OPERATORS.map(([slug]) => slug)])
  }
}
