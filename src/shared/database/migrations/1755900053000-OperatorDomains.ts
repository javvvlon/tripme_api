import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const DOMAINS: Array<[slug: string, from: string, to: string]> = [
  ['easybooking', 'https://b2b.easybooking.uz', 'https://tours.easybooking.uz'],
  ['selfietravel', 'https://b2b.selfietravel.uz', 'https://b2b.selfietravel.kz'],
  ['fstravel', 'https://b2b.fstravel.com', 'https://b2b.fstravel.asia'],
]

export class OperatorDomains1755900053000 implements MigrationInterface {
  name = 'OperatorDomains1755900053000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [slug, from, to] of DOMAINS) {
      await queryRunner.query(`update operators set site_url = $1, updated_at = now() where slug = $2 and site_url = $3`, [to, slug, from])
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [slug, from, to] of DOMAINS) {
      await queryRunner.query(`update operators set site_url = $1, updated_at = now() where slug = $2 and site_url = $3`, [from, slug, to])
    }
  }
}
