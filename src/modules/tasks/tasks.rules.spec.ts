import { describe, expect, it } from 'vitest'
import { UserRole } from '~/modules/auth/contracts/auth'
import { canAssignTo, canSeeTask, changesOf, commentOf, isOverdue, labelsOf, taskKey, tashkentToday } from './tasks.rules'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const agent = { id: 'a', role: UserRole.Agent }
const manager = { id: 'm', role: UserRole.Manager }

describe('task access', () => {
  it('lets an agent see only tasks given to them or written by them', () => {
    expect(canSeeTask(agent, { assigneeId: 'a', authorId: 'm' })).toBe(true)
    expect(canSeeTask(agent, { assigneeId: null, authorId: 'a' })).toBe(true)
    expect(canSeeTask(agent, { assigneeId: 'x', authorId: 'm' })).toBe(false)
    expect(canSeeTask(manager, { assigneeId: 'x', authorId: 'y' })).toBe(true)
  })

  it('lets only managers give tasks to someone else', () => {
    expect(canAssignTo(agent, 'a')).toBe(true)
    expect(canAssignTo(agent, 'x')).toBe(false)
    expect(canAssignTo(agent, null)).toBe(false)
    expect(canAssignTo(manager, 'x')).toBe(true)
    expect(canAssignTo(manager, null)).toBe(true)
  })
})

describe('task input', () => {
  it('needs a title when creating and keeps only known fields', () => {
    expect(() => changesOf({ title: '  ' }, true)).toThrow()
    expect(changesOf({ title: ' Позвонить клиенту ', priority: 'high', due_on: '2026-10-31', assignee_id: '' }, true)).toEqual({
      title: 'Позвонить клиенту',
      priority: 'high',
      dueOn: '2026-10-31',
      assigneeId: null,
    })
    expect(changesOf({ status: 'review' }, false)).toEqual({ status: 'review' })
  })

  it('rejects unknown statuses, priorities and dates', () => {
    expect(() => changesOf({ status: 'closed' }, false)).toThrow()
    expect(() => changesOf({ priority: 'asap' }, false)).toThrow()
    expect(() => changesOf({ due_on: '31.10.2026' }, false)).toThrow()
    expect(changesOf({ due_on: '' }, false)).toEqual({ dueOn: null })
  })

  it('keeps labels short, lowercase and unique', () => {
    expect(labelsOf([' Визы ', 'визы', '', 'Сайт', 42])).toEqual(['визы', 'сайт'])
    expect(labelsOf('визы')).toEqual([])
  })

  it('refuses an empty comment', () => {
    expect(() => commentOf('   ')).toThrow()
    expect(commentOf(' Готово ')).toBe('Готово')
  })
})

describe('task helpers', () => {
  it('builds the TM key and spots overdue tasks', () => {
    expect(taskKey('17')).toBe('TM-17')
    expect(isOverdue('2026-10-20', 'todo', '2026-10-21')).toBe(true)
    expect(isOverdue('2026-10-20', 'done', '2026-10-21')).toBe(false)
    expect(isOverdue(null, 'todo', '2026-10-21')).toBe(false)
    expect(tashkentToday(new Date('2026-10-21T20:30:00Z'))).toBe('2026-10-22')
  })
})
