import { BadRequestException } from '@nestjs/common'
import { seesEveryone } from '~/modules/leads/lead.access'
import type { IViewer } from '~/modules/leads/lead.access'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export enum TaskStatus {
  Backlog = 'backlog',
  Todo = 'todo',
  InProgress = 'in_progress',
  Review = 'review',
  Done = 'done',
}

export const TASK_STATUSES = Object.values(TaskStatus) as string[]

export enum TaskPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Urgent = 'urgent',
}

export const TASK_PRIORITIES = Object.values(TaskPriority) as string[]

export enum TaskEventKind {
  Created = 'created',
  Status = 'status',
  Assigned = 'assigned',
  Priority = 'priority',
  Due = 'due',
  Title = 'title',
  Comment = 'comment',
  Archived = 'archived',
  Restored = 'restored',
}

export const TASK_KEY_PREFIX = 'TM'

export const TITLE_LIMIT = 200

export const DESCRIPTION_LIMIT = 20_000

export const COMMENT_LIMIT = 4000

export const LABEL_LIMIT = 8

export interface ITaskOwnership {
  assigneeId: string | null
  authorId: string
}

export interface ITaskInput {
  title?: unknown
  description?: unknown
  status?: unknown
  priority?: unknown
  assignee_id?: unknown
  due_on?: unknown
  labels?: unknown
}

export interface ITaskChanges {
  title?: string
  description?: string
  status?: string
  priority?: string
  assigneeId?: string | null
  dueOn?: string | null
  labels?: string[]
}

export const taskKey = (taskNo: string | number): string => `${TASK_KEY_PREFIX}-${taskNo}`

export const canSeeTask = (viewer: IViewer, task: ITaskOwnership): boolean =>
  seesEveryone(viewer) || task.assigneeId === viewer.id || task.authorId === viewer.id

export const canAssignTo = (viewer: IViewer, assigneeId: string | null): boolean =>
  seesEveryone(viewer) || assigneeId === viewer.id

const DATE = /^\d{4}-\d{2}-\d{2}$/

const clean = (value: unknown, limit: number): string => (typeof value === 'string' ? value.trim().slice(0, limit) : '')

export function labelsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()

  for (const entry of value) {
    const label = clean(entry, 32).toLowerCase()

    if (label) seen.add(label)
  }

  return [...seen].slice(0, LABEL_LIMIT)
}

export function changesOf(input: ITaskInput, creating: boolean): ITaskChanges {
  const changes: ITaskChanges = {}

  if (creating || input.title !== undefined) {
    const title = clean(input.title, TITLE_LIMIT)

    if (!title) throw new BadRequestException('Write what needs to be done')

    changes.title = title
  }

  if (input.description !== undefined) changes.description = clean(input.description, DESCRIPTION_LIMIT)

  if (input.status !== undefined) {
    if (!TASK_STATUSES.includes(String(input.status))) throw new BadRequestException('Unknown status')

    changes.status = String(input.status)
  }

  if (input.priority !== undefined) {
    if (!TASK_PRIORITIES.includes(String(input.priority))) throw new BadRequestException('Unknown priority')

    changes.priority = String(input.priority)
  }

  if (input.assignee_id !== undefined) {
    changes.assigneeId = typeof input.assignee_id === 'string' && input.assignee_id ? input.assignee_id : null
  }

  if (input.due_on !== undefined) {
    const due = typeof input.due_on === 'string' ? input.due_on.trim() : ''

    if (due && !DATE.test(due)) throw new BadRequestException('The due date must look like 2026-10-31')

    changes.dueOn = due || null
  }

  if (input.labels !== undefined) changes.labels = labelsOf(input.labels)

  return changes
}

export function commentOf(value: unknown): string {
  const body = clean(value, COMMENT_LIMIT)

  if (!body) throw new BadRequestException('The comment is empty')

  return body
}

export const isOverdue = (dueOn: string | null, status: string, today: string): boolean =>
  Boolean(dueOn) && status !== TaskStatus.Done && dueOn! < today

export const tashkentToday = (now = new Date()): string =>
  new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
