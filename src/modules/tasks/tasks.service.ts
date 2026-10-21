import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { UserEntity } from '~/modules/auth/entities'
import { STAFF_ROLES, seesEveryone } from '~/modules/leads/lead.access'
import type { IViewer } from '~/modules/leads/lead.access'
import { TaskEntity, TaskEventEntity } from './task.entities'
import {
  TaskEventKind,
  TaskStatus,
  TASK_STATUSES,
  canAssignTo,
  canSeeTask,
  changesOf,
  commentOf,
  isOverdue,
  tashkentToday,
  taskKey,
} from './tasks.rules'
import type { ITaskChanges, ITaskInput } from './tasks.rules'

export interface IPerson {
  uuid: string
  name: string
}

export interface ITaskPayload {
  uuid: string
  key: string
  title: string
  description: string
  status: string
  priority: string
  assignee: IPerson | null
  author: IPerson | null
  due_on: string | null
  labels: string[]
  overdue: boolean
  comments: number
  completed_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface ITaskEventPayload {
  uuid: string
  kind: string
  from: string | null
  to: string | null
  body: string
  actor: IPerson | null
  at: string
}

export interface ITaskQuery {
  q?: string
  status?: string
  assignee?: string
  mine?: string
  archived?: string
}

export interface ITaskSummary {
  open: number
  overdue: number
  due_today: number
  review: number
}

const LIST_LIMIT = 500

const PRIORITY_ORDER = `array_position(array['urgent','high','medium','low']::text[], t.priority)`

const nameOf = (user: Pick<UserEntity, 'firstName' | 'lastName' | 'email'>): string =>
  [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(TaskEntity) private readonly tasks: Repository<TaskEntity>,
    @InjectRepository(TaskEventEntity) private readonly events: Repository<TaskEventEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
  ) {}

  statuses() {
    return { items: TASK_STATUSES }
  }

  async list(query: ITaskQuery, viewer: IViewer): Promise<ITaskPayload[]> {
    const builder = this.tasks.createQueryBuilder('t')

    builder.where(query.archived === '1' ? 't.archived_at is not null' : 't.archived_at is null')

    if (!seesEveryone(viewer)) builder.andWhere('(t.assignee_id = :me or t.author_id = :me)', { me: viewer.id })
    if (query.mine === '1') builder.andWhere('t.assignee_id = :me', { me: viewer.id })
    if (query.status && TASK_STATUSES.includes(query.status)) builder.andWhere('t.status = :status', { status: query.status })

    if (query.assignee === 'none') builder.andWhere('t.assignee_id is null')
    else if (query.assignee) builder.andWhere('t.assignee_id = :assignee', { assignee: query.assignee })

    const q = query.q?.trim()

    if (q) {
      const number = /^(?:tm-?)?(\d+)$/i.exec(q)?.[1]

      builder.andWhere(
        number ? '(t.task_no = :number or t.title ilike :q)' : '(t.title ilike :q or t.description ilike :q)',
        { number, q: `%${q.replace(/[%_]/g, '')}%` },
      )
    }

    const rows = await builder
      .orderBy(PRIORITY_ORDER, 'ASC')
      .addOrderBy('t.due_on', 'ASC', 'NULLS LAST')
      .addOrderBy('t.updated_at', 'DESC')
      .limit(LIST_LIMIT)
      .getMany()

    return this.payloads(rows)
  }

  async summary(viewer: IViewer): Promise<ITaskSummary> {
    const today = tashkentToday()
    const [row] = await this.tasks.query(
      `select
         count(*) filter (where status <> 'done')::int as open,
         count(*) filter (where status <> 'done' and due_on < $2)::int as overdue,
         count(*) filter (where status <> 'done' and due_on = $2)::int as due_today,
         count(*) filter (where status = 'review')::int as review
       from tasks where assignee_id = $1 and archived_at is null`,
      [viewer.id, today],
    )

    return { open: row?.open ?? 0, overdue: row?.overdue ?? 0, due_today: row?.due_today ?? 0, review: row?.review ?? 0 }
  }

  async one(id: string, viewer: IViewer): Promise<ITaskPayload & { events: ITaskEventPayload[] }> {
    const task = await this.visible(id, viewer)
    const [payload] = await this.payloads([task])
    const events = await this.events.find({ where: { taskId: task.id }, order: { createdAt: 'ASC' } })
    const people = await this.people(events.map(event => event.actorId))

    return {
      ...payload!,
      events: events.map(event => ({
        uuid: event.id,
        kind: event.kind,
        from: event.fromValue,
        to: event.toValue,
        body: event.body,
        actor: event.actorId ? people.get(event.actorId) ?? null : null,
        at: event.createdAt.toISOString(),
      })),
    }
  }

  async create(input: ITaskInput, viewer: IViewer): Promise<ITaskPayload> {
    const changes = changesOf(input ?? {}, true)
    const assigneeId = changes.assigneeId === undefined ? viewer.id : changes.assigneeId

    await this.checkAssignee(viewer, assigneeId)

    const status = changes.status ?? TaskStatus.Todo
    const task = await this.tasks.save(this.tasks.create({
      title: changes.title!,
      description: changes.description ?? '',
      status,
      priority: changes.priority ?? 'medium',
      assigneeId,
      authorId: viewer.id,
      dueOn: changes.dueOn ?? null,
      labels: changes.labels ?? [],
      completedAt: status === TaskStatus.Done ? new Date() : null,
    }))

    await this.record(task.id, TaskEventKind.Created, { to: status, actorId: viewer.id })

    const [payload] = await this.payloads([task])

    return payload!
  }

  async update(id: string, input: ITaskInput, viewer: IViewer): Promise<ITaskPayload> {
    const task = await this.visible(id, viewer)

    if (task.archivedAt) throw new BadRequestException('Restore the task before changing it')

    const changes = changesOf(input ?? {}, false)

    if (changes.assigneeId !== undefined && changes.assigneeId !== task.assigneeId) await this.checkAssignee(viewer, changes.assigneeId)

    const log = this.diff(task, changes)

    Object.assign(task, {
      ...(changes.title !== undefined ? { title: changes.title } : {}),
      ...(changes.description !== undefined ? { description: changes.description } : {}),
      ...(changes.priority !== undefined ? { priority: changes.priority } : {}),
      ...(changes.assigneeId !== undefined ? { assigneeId: changes.assigneeId } : {}),
      ...(changes.dueOn !== undefined ? { dueOn: changes.dueOn } : {}),
      ...(changes.labels !== undefined ? { labels: changes.labels } : {}),
    })

    if (changes.status !== undefined && changes.status !== task.status) {
      task.completedAt = changes.status === TaskStatus.Done ? new Date() : null
      task.status = changes.status
    }

    task.updatedAt = new Date()

    await this.tasks.save(task)

    for (const entry of log) await this.record(task.id, entry.kind, { from: entry.from, to: entry.to, actorId: viewer.id })

    const [payload] = await this.payloads([task])

    return payload!
  }

  async comment(id: string, body: unknown, viewer: IViewer): Promise<ITaskEventPayload> {
    const task = await this.visible(id, viewer)
    const text = commentOf(body)
    const event = await this.record(task.id, TaskEventKind.Comment, { body: text, actorId: viewer.id })

    await this.tasks.update({ id: task.id }, { updatedAt: new Date() })

    const people = await this.people([viewer.id])

    return {
      uuid: event.id,
      kind: event.kind,
      from: null,
      to: null,
      body: event.body,
      actor: people.get(viewer.id) ?? null,
      at: event.createdAt.toISOString(),
    }
  }

  async archive(id: string, viewer: IViewer): Promise<ITaskPayload> {
    return this.toggleArchive(id, viewer, true)
  }

  async restore(id: string, viewer: IViewer): Promise<ITaskPayload> {
    return this.toggleArchive(id, viewer, false)
  }

  private async toggleArchive(id: string, viewer: IViewer, archived: boolean): Promise<ITaskPayload> {
    const task = await this.visible(id, viewer)

    if (Boolean(task.archivedAt) === archived) {
      const [same] = await this.payloads([task])

      return same!
    }

    task.archivedAt = archived ? new Date() : null
    task.updatedAt = new Date()

    await this.tasks.save(task)
    await this.record(task.id, archived ? TaskEventKind.Archived : TaskEventKind.Restored, { actorId: viewer.id })

    const [payload] = await this.payloads([task])

    return payload!
  }

  private diff(task: TaskEntity, changes: ITaskChanges): Array<{ kind: TaskEventKind, from: string | null, to: string | null }> {
    const out: Array<{ kind: TaskEventKind, from: string | null, to: string | null }> = []

    if (changes.status !== undefined && changes.status !== task.status) out.push({ kind: TaskEventKind.Status, from: task.status, to: changes.status })
    if (changes.assigneeId !== undefined && changes.assigneeId !== task.assigneeId) out.push({ kind: TaskEventKind.Assigned, from: task.assigneeId, to: changes.assigneeId })
    if (changes.priority !== undefined && changes.priority !== task.priority) out.push({ kind: TaskEventKind.Priority, from: task.priority, to: changes.priority })
    if (changes.dueOn !== undefined && changes.dueOn !== task.dueOn) out.push({ kind: TaskEventKind.Due, from: task.dueOn, to: changes.dueOn })
    if (changes.title !== undefined && changes.title !== task.title) out.push({ kind: TaskEventKind.Title, from: task.title, to: changes.title })

    return out
  }

  private async checkAssignee(viewer: IViewer, assigneeId: string | null): Promise<void> {
    if (!canAssignTo(viewer, assigneeId)) throw new ForbiddenException('Only a manager can give a task to someone else')

    if (!assigneeId) return

    const user = await this.users.findOne({ where: { id: assigneeId }, select: { id: true, role: true, archivedAt: true } })

    if (!user || !STAFF_ROLES.includes(user.role) || user.archivedAt) throw new BadRequestException('Choose an active team member')
  }

  private async visible(id: string, viewer: IViewer): Promise<TaskEntity> {
    const task = /^[0-9a-f-]{36}$/i.test(id) ? await this.tasks.findOne({ where: { id } }) : null

    if (!task || !canSeeTask(viewer, task)) throw new NotFoundException('Task not found')

    return task
  }

  private async record(
    taskId: string,
    kind: TaskEventKind,
    change: { from?: string | null, to?: string | null, body?: string, actorId: string | null },
  ): Promise<TaskEventEntity> {
    return this.events.save(this.events.create({
      taskId,
      kind,
      fromValue: change.from ?? null,
      toValue: change.to ?? null,
      body: change.body ?? '',
      actorId: change.actorId,
    }))
  }

  private async people(ids: Array<string | null>): Promise<Map<string, IPerson>> {
    const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))]

    if (!wanted.length) return new Map()

    const rows = await this.users.find({ where: { id: In(wanted) }, select: { id: true, firstName: true, lastName: true, email: true } })

    return new Map(rows.map(row => [row.id, { uuid: row.id, name: nameOf(row) }]))
  }

  private async payloads(rows: TaskEntity[]): Promise<ITaskPayload[]> {
    if (!rows.length) return []

    const people = await this.people(rows.flatMap(row => [row.assigneeId, row.authorId]))
    const counts: Array<{ task_id: string, n: number }> = await this.events.query(
      `select task_id, count(*)::int as n from task_events where kind = 'comment' and task_id = any($1) group by task_id`,
      [rows.map(row => row.id)],
    )
    const commentCount = new Map(counts.map(row => [row.task_id, row.n]))
    const today = tashkentToday()

    return rows.map(row => ({
      uuid: row.id,
      key: taskKey(row.taskNo),
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      assignee: row.assigneeId ? people.get(row.assigneeId) ?? null : null,
      author: people.get(row.authorId) ?? null,
      due_on: row.dueOn,
      labels: row.labels ?? [],
      overdue: isOverdue(row.dueOn, row.status, today),
      comments: commentCount.get(row.id) ?? 0,
      completed_at: row.completedAt?.toISOString() ?? null,
      archived_at: row.archivedAt?.toISOString() ?? null,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    }))
  }
}
