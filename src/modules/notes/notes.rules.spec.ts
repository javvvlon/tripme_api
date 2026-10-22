import { BadRequestException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { UserRole } from '~/modules/auth/contracts/auth'
import { NoteKind, canEdit, canWrite, draftOf, excerptOf, noteKey, refsOf } from './notes.rules'

const agent = { id: 'a', role: UserRole.Agent }
const manager = { id: 'm', role: UserRole.Manager }

describe('notes rules', () => {
  it('numbers records per kind with a fixed width', () => {
    expect(noteKey(NoteKind.Decision, 4)).toBe('DEC-004')
    expect(noteKey(NoteKind.Directive, 12)).toBe('DIR-012')
    expect(noteKey(NoteKind.Note, 1234)).toBe('NOTE-1234')
  })

  it('lets only managers and admins publish decisions and directives', () => {
    expect(canWrite(agent, NoteKind.Note)).toBe(true)
    expect(canWrite(agent, NoteKind.Decision)).toBe(false)
    expect(canWrite(agent, NoteKind.Directive)).toBe(false)
    expect(canWrite(manager, NoteKind.Directive)).toBe(true)
  })

  it('keeps decisions and directives unchangeable', () => {
    expect(canEdit(manager, { kind: NoteKind.Decision, authorId: 'm' })).toBe(false)
    expect(canEdit(agent, { kind: NoteKind.Note, authorId: 'a' })).toBe(true)
    expect(canEdit(agent, { kind: NoteKind.Note, authorId: 'm' })).toBe(false)
    expect(canEdit(manager, { kind: NoteKind.Note, authorId: 'a' })).toBe(true)
  })

  it('normalises document and task codes', () => {
    expect(refsOf('tech-spec-003, tm-12, TM-12')).toEqual(['TECH-SPEC-003', 'TM-12'])
    expect(() => refsOf(['not a code!'])).toThrow(BadRequestException)
  })

  it('requires an audience for directives and text for records', () => {
    expect(() => draftOf({ kind: 'directive', title: 'Prices', body: 'Use the operator rate' })).toThrow(BadRequestException)
    expect(() => draftOf({ kind: 'decision', title: 'Prices', body: '' })).toThrow(BadRequestException)
    expect(draftOf({ kind: 'directive', title: 'Prices', body: 'Rate', audience: 'all' }).audience).toBe('all')
    expect(draftOf({ kind: 'note', title: 'Idea', rationale: 'ignored', supersedes_id: '00000000-0000-0000-0000-000000000000' }))
      .toMatchObject({ rationale: '', supersedesId: null, audience: [] })
  })

  it('builds a plain one-line excerpt from Markdown', () => {
    expect(excerptOf('## Rule\n\n- **Prices** at the [operator](https://x) rate')).toBe('Rule Prices at the operator rate')
  })
})
