import { BadRequestException } from '@nestjs/common'
import { seesEveryone } from '~/modules/leads/lead.access'
import type { IViewer } from '~/modules/leads/lead.access'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export enum NoteKind {
  Note = 'note',
  Decision = 'decision',
  Directive = 'directive',
}

export const NOTE_KINDS = Object.values(NoteKind) as string[]

export const NOTE_PREFIX: Record<NoteKind, string> = {
  [NoteKind.Note]: 'NOTE',
  [NoteKind.Decision]: 'DEC',
  [NoteKind.Directive]: 'DIR',
}

export const TITLE_LIMIT = 200

export const BODY_LIMIT = 20_000

export const RATIONALE_LIMIT = 10_000

export const REF_LIMIT = 12

export const TASK_REF = /^TM-(\d+)$/

export const NOTE_REF = /^(NOTE|DEC|DIR)-0*(\d+)$/

const REF = /^[A-ZА-ЯЁ0-9][A-ZА-ЯЁ0-9._-]{0,39}$/

const UUID = /^[0-9a-f-]{36}$/i

export interface INoteInput {
  kind?: unknown
  title?: unknown
  body?: unknown
  rationale?: unknown
  refs?: unknown
  audience?: unknown
  supersedes_id?: unknown
}

export interface INoteDraft {
  kind: NoteKind
  title: string
  body: string
  rationale: string
  refs: string[]
  audience: 'all' | string[]
  supersedesId: string | null
}

export interface INoteChanges {
  title?: string
  body?: string
  refs?: string[]
}

export const noteKey = (kind: string, n: number): string =>
  `${NOTE_PREFIX[kind as NoteKind] ?? 'NOTE'}-${String(n).padStart(3, '0')}`

export const isRecord = (kind: string): boolean => kind === NoteKind.Decision || kind === NoteKind.Directive

export const canWrite = (viewer: IViewer, kind: string): boolean => kind === NoteKind.Note || seesEveryone(viewer)

export const canEdit = (viewer: IViewer, note: { kind: string, authorId: string }): boolean =>
  note.kind === NoteKind.Note && (note.authorId === viewer.id || seesEveryone(viewer))

export const canArchive = (viewer: IViewer, note: { authorId: string }): boolean => note.authorId === viewer.id || seesEveryone(viewer)

const clean = (value: unknown, limit: number): string => (typeof value === 'string' ? value.trim().slice(0, limit) : '')

export function refsOf(value: unknown): string[] {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  const seen = new Set<string>()

  for (const entry of list) {
    const ref = clean(entry, 40).toUpperCase()

    if (!ref) continue
    if (!REF.test(ref)) throw new BadRequestException(`«${ref}» is not a document or task code`)

    seen.add(ref)
  }

  return [...seen].slice(0, REF_LIMIT)
}

function audienceOf(value: unknown): 'all' | string[] {
  if (value === 'all') return 'all'

  const ids = Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && UUID.test(id)))] : []

  if (!ids.length) throw new BadRequestException('Choose who the directive is for')

  return ids
}

export function draftOf(input: INoteInput): INoteDraft {
  const kind = String(input.kind ?? NoteKind.Note)

  if (!NOTE_KINDS.includes(kind)) throw new BadRequestException('Unknown kind of note')

  const title = clean(input.title, TITLE_LIMIT)
  const body = clean(input.body, BODY_LIMIT)

  if (!title) throw new BadRequestException('Give the note a title')
  if (isRecord(kind) && !body) throw new BadRequestException('Write the text of the record')

  const supersedes = typeof input.supersedes_id === 'string' && UUID.test(input.supersedes_id) ? input.supersedes_id : null

  return {
    kind: kind as NoteKind,
    title,
    body,
    rationale: kind === NoteKind.Decision ? clean(input.rationale, RATIONALE_LIMIT) : '',
    refs: refsOf(input.refs),
    audience: kind === NoteKind.Directive ? audienceOf(input.audience) : [],
    supersedesId: isRecord(kind) ? supersedes : null,
  }
}

export function changesOf(input: INoteInput): INoteChanges {
  const changes: INoteChanges = {}

  if (input.title !== undefined) {
    const title = clean(input.title, TITLE_LIMIT)

    if (!title) throw new BadRequestException('Give the note a title')

    changes.title = title
  }

  if (input.body !== undefined) changes.body = clean(input.body, BODY_LIMIT)
  if (input.refs !== undefined) changes.refs = refsOf(input.refs)

  return changes
}

export const excerptOf = (body: string, limit = 160): string => {
  const text = body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
    .replace(/[#>*_`~|\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text
}
