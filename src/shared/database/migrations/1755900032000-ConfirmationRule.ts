import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class ConfirmationRule1755900032000 implements MigrationInterface {
  name = 'ConfirmationRule1755900032000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table orders add column if not exists contract_signed_at timestamptz`)
    await queryRunner.query(`alter table orders add column if not exists contract_document_id uuid references order_documents(id) on delete set null`)
    await queryRunner.query(`alter table orders add column if not exists legacy_paid boolean not null default false`)

    await queryRunner.query(`
      update orders set legacy_paid = true
      where status in ('paid', 'issued', 'travelling', 'completed')
        and not exists (select 1 from order_payments p where p.order_id = orders.id)
    `)
    await queryRunner.query(`update orders set status = 'confirmed', updated_at = now() where status = 'paid'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table orders drop column if exists legacy_paid`)
    await queryRunner.query(`alter table orders drop column if exists contract_document_id`)
    await queryRunner.query(`alter table orders drop column if exists contract_signed_at`)
  }
}
