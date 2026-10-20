import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const MARK = 'auto_backfill'

const LIVE_ORDER = `exists (select 1 from orders o where o.lead_id = l.id and o.status <> 'cancelled')`

const STARTED = `l.status = 'new' and (l.manager_id is not null or coalesce(l.comment, '') <> '' or ${LIVE_ORDER})`

const DEALT = `l.status in ('in_progress', 'quote_sent') and ${LIVE_ORDER}`

export class LeadAutoStatuses1755900054000 implements MigrationInterface {
  name = 'LeadAutoStatuses1755900054000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `insert into lead_events (lead_id, kind, from_value, to_value, subject, actor_id, created_at)
       select l.id, 'status', 'new', 'in_progress', $1, null, now() from leads l where ${STARTED}`,
      [MARK],
    )
    await queryRunner.query(`update leads l set status = 'in_progress' where ${STARTED}`)

    await queryRunner.query(
      `insert into lead_events (lead_id, kind, from_value, to_value, subject, actor_id, created_at)
       select l.id, 'status', l.status, 'won', $1, null, now() + interval '1 millisecond' from leads l where ${DEALT}`,
      [MARK],
    )
    await queryRunner.query(`update leads l set status = 'won' where ${DEALT}`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `update leads l set status = e.from_value from lead_events e
       where e.lead_id = l.id and e.subject = $1 and e.to_value = 'won' and l.status = 'won'`,
      [MARK],
    )
    await queryRunner.query(
      `update leads l set status = 'new' from lead_events e
       where e.lead_id = l.id and e.subject = $1 and e.to_value = 'in_progress' and l.status = 'in_progress'`,
      [MARK],
    )
    await queryRunner.query(`delete from lead_events where subject = $1`, [MARK])
  }
}
