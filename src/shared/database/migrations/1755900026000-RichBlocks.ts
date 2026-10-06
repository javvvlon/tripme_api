import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class RichBlocks1755900026000 implements MigrationInterface {
  name = 'RichBlocks1755900026000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table content_section_translations add column if not exists eyebrow text`)
    await queryRunner.query(`alter table content_section_translations add column if not exists body text`)
    await queryRunner.query(`alter table content_section_translations add column if not exists cta_label text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table content_section_translations drop column if exists cta_label`)
    await queryRunner.query(`alter table content_section_translations drop column if exists body`)
    await queryRunner.query(`alter table content_section_translations drop column if exists eyebrow`)
  }
}
