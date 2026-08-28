import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class PostAuthor1755900006000 implements MigrationInterface {
  name = 'PostAuthor1755900006000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table posts
        add column if not exists author_id uuid references users (id) on delete set null
    `)

    await queryRunner.query(`
      create index if not exists posts_author_key on posts (author_id)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop index if exists posts_author_key`)
    await queryRunner.query(`alter table posts drop column if exists author_id`)
  }
}
