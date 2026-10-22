import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, IsNull, Not, Repository } from 'typeorm'
import { UserEntity } from '~/modules/auth/entities'
import { STAFF_ROLES } from '~/modules/leads/lead.access'
import type { IViewer } from '~/modules/leads/lead.access'
import { canSeeTask, taskKey } from '~/modules/tasks/tasks.rules'
import { NoteAckEntity, NoteEntity } from './note.entities'
import { NOTE_KINDS, NOTE_REF, NoteKind, TASK_REF, canArchive, canEdit, canWrite, changesOf, draftOf, excerptOf, noteKey } from './notes.rules'
import type { INoteDraft, INoteInput } from './notes.rules'

export interface IPerson {
  uuid: string
  name: string
}

export interface INoteRef {
  uuid: string
  key: string
}

export interface INoteAcks {
  total: number
  done: number
  mine: 'pending' | 'done' | null
}

export interface INotePayload {
  uuid: string
  key: string
  kind: string
  title: string
  excerpt: string
  author: IPerson | null
  refs: string[]
  supersedes: INoteRef | null
  superseded_by: INoteRef | null
  acks: INoteAcks | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface INoteDetailPayload extends INotePayload {
  body: string
  rationale: string
  audience: Array<{ person: IPerson, acknowledged_at: string | null }>
  tasks: Array<{ uuid: string, key: string, title: string, status: string }>
  notes: Array<INoteRef & { kind: string, title: string }>
}

export interface INoteQuery {
  kind?: string
  q?: string
  archived?: string
}

const LIST_LIMIT = 300

const NUMBER_ATTEMPTS = 3

const UNIQUE_VIOLATION = '23505'

const nameOf = (user: Pick<UserEntity, 'firstName' | 'lastName' | 'email'>): string =>
  [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class NotesService {
  constructor(
    @InjectRepository(NoteEntity) private readonly notes: Repository<NoteEntity>,
    @InjectRepository(NoteAckEntity) private readonly acks: Repository<NoteAckEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
  ) {}

  async list(query: INoteQuery, viewer: IViewer): Promise<INotePayload[]> {
    const builder = this.notes.createQueryBuilder('n')

    builder.where(query.archived === '1' ? 'n.archived_at is not null' : 'n.archived_at is null')

    if (query.kind && NOTE_KINDS.includes(query.kind)) builder.andWhere('n.kind = :kind', { kind: query.kind })

    const q = query.q?.trim()

    if (q) {
      const code = /^(NOTE|DEC|DIR)-?0*(\d+)$/i.exec(q)

      builder.andWhere(
        code ? '(n.kind = :codeKind and n.kind_no = :codeNo)' : '(n.title ilike :q or n.body ilike :q or array_to_string(n.refs, \' \') ilike :q)',
        code
          ? { codeKind: { NOTE: NoteKind.Note, DEC: NoteKind.Decision, DIR: NoteKind.Directive }[code[1]!.toUpperCase()], codeNo: Number(code[2]) }
          : { q: `%${q.replace(/[%_]/g, '')}%` },
      )
    }

    const rows = await builder.orderBy('n.created_at', 'DESC').limit(LIST_LIMIT).getMany()

    return this.payloads(rows, viewer)
  }

  async pending(viewer: IViewer): Promise<Array<INoteRef & { title: string, author: IPerson | null, created_at: string }>> {
    const rows: Array<{ id: string, kind_no: number, title: string, author_id: string, created_at: Date }> = await this.notes.query(
      `select n.id, n.kind_no, n.title, n.author_id, n.created_at
         from note_acks a join notes n on n.id = a.note_id
        where a.user_id = $1 and a.acknowledged_at is null and n.kind = $2 and n.archived_at is null
          and not exists (select 1 from notes s where s.supersedes_id = n.id and s.archived_at is null)
        order by n.created_at asc`,
      [viewer.id, NoteKind.Directive],
    )
    const people = await this.people(rows.map(row => row.author_id))

    return rows.map(row => ({
      uuid: row.id,
      key: noteKey(NoteKind.Directive, row.kind_no),
      title: row.title,
      author: people.get(row.author_id) ?? null,
      created_at: new Date(row.created_at).toISOString(),
    }))
  }

  async one(id: string, viewer: IViewer): Promise<INoteDetailPayload> {
    const note = await this.find(id)
    const [payload] = await this.payloads([note], viewer)
    const acks = note.kind === NoteKind.Directive ? await this.acks.find({ where: { noteId: note.id } }) : []
    const people = await this.people(acks.map(ack => ack.userId))

    return {
      ...payload!,
      body: note.body,
      rationale: note.rationale,
      audience: acks
        .map(ack => ({ person: people.get(ack.userId) ?? { uuid: ack.userId, name: '—' }, acknowledged_at: ack.acknowledgedAt?.toISOString() ?? null }))
        .sort((a, b) => Number(Boolean(b.acknowledged_at)) - Number(Boolean(a.acknowledged_at)) || a.person.name.localeCompare(b.person.name)),
      tasks: await this.linkedTasks(note.refs, viewer),
      notes: await this.linkedNotes(note.refs, note.id),
    }
  }

  async create(input: INoteInput, viewer: IViewer): Promise<INoteDetailPayload> {
    const draft = draftOf(input ?? {})

    if (!canWrite(viewer, draft.kind)) throw new ForbiddenException('Only a manager or an admin can publish decisions and directives')

    if (draft.supersedesId) await this.checkReplaceable(draft)

    const audience = draft.kind === NoteKind.Directive ? await this.audienceOf(draft.audience, viewer) : []
    const note = await this.insert(draft, viewer)

    if (audience.length) await this.acks.save(audience.map(userId => this.acks.create({ noteId: note.id, userId })))

    return this.one(note.id, viewer)
  }

  async update(id: string, input: INoteInput, viewer: IViewer): Promise<INoteDetailPayload> {
    const note = await this.find(id)

    if (!canEdit(viewer, note)) {
      throw new ForbiddenException(note.kind === NoteKind.Note ? 'Only the author can change this note' : 'Published records cannot be changed — issue a new one instead')
    }

    if (note.archivedAt) throw new BadRequestException('Restore the note before changing it')

    const changes = changesOf(input ?? {})

    Object.assign(note, changes, { updatedAt: new Date() })

    await this.notes.save(note)

    return this.one(note.id, viewer)
  }

  async acknowledge(id: string, viewer: IViewer): Promise<INoteDetailPayload> {
    const note = await this.find(id)

    if (note.kind !== NoteKind.Directive) throw new BadRequestException('Only directives are acknowledged')
    if (note.archivedAt || await this.supersededBy(note.id)) throw new BadRequestException('This directive is no longer in force')

    const ack = await this.acks.findOne({ where: { noteId: note.id, userId: viewer.id } })

    if (!ack) throw new ForbiddenException('This directive is not addressed to you')

    if (!ack.acknowledgedAt) {
      ack.acknowledgedAt = new Date()
      await this.acks.save(ack)
    }

    return this.one(note.id, viewer)
  }

  async archive(id: string, viewer: IViewer): Promise<INoteDetailPayload> {
    return this.toggleArchive(id, viewer, true)
  }

  async restore(id: string, viewer: IViewer): Promise<INoteDetailPayload> {
    return this.toggleArchive(id, viewer, false)
  }

  private async toggleArchive(id: string, viewer: IViewer, archived: boolean): Promise<INoteDetailPayload> {
    const note = await this.find(id)

    if (!canArchive(viewer, note)) throw new ForbiddenException('Only the author or a manager can archive this')

    if (Boolean(note.archivedAt) !== archived) {
      note.archivedAt = archived ? new Date() : null
      note.updatedAt = new Date()
      await this.notes.save(note)
    }

    return this.one(note.id, viewer)
  }

  private async insert(draft: INoteDraft, viewer: IViewer): Promise<NoteEntity> {
    for (let attempt = 1; ; attempt++) {
      const [row]: Array<{ next: number }> = await this.notes.query(
        `select coalesce(max(kind_no), 0) + 1 as next from notes where kind = $1`,
        [draft.kind],
      )

      try {
        return await this.notes.save(this.notes.create({
          kind: draft.kind,
          kindNo: Number(row?.next ?? 1),
          title: draft.title,
          body: draft.body,
          rationale: draft.rationale,
          refs: draft.refs,
          authorId: viewer.id,
          supersedesId: draft.supersedesId,
        }))
      }
      catch (error) {
        if ((error as { code?: string }).code !== UNIQUE_VIOLATION || attempt >= NUMBER_ATTEMPTS) throw error
      }
    }
  }

  private async checkReplaceable(draft: INoteDraft): Promise<void> {
    const previous = await this.notes.findOne({ where: { id: draft.supersedesId! } })

    if (!previous || previous.kind !== draft.kind) throw new BadRequestException('A record can only replace one of the same kind')
    if (previous.archivedAt) throw new BadRequestException('That record is archived')
    if (await this.supersededBy(previous.id)) throw new BadRequestException('That record has already been replaced')
  }

  private async audienceOf(audience: 'all' | string[], viewer: IViewer): Promise<string[]> {
    const staff = await this.users.find({
      where: { role: In(STAFF_ROLES), archivedAt: IsNull(), ...(audience === 'all' ? { id: Not(viewer.id) } : { id: In(audience) }) },
      select: { id: true },
    })

    if (!staff.length) throw new BadRequestException('Choose at least one active team member')

    return staff.map(user => user.id)
  }

  private async supersededBy(id: string): Promise<NoteEntity | null> {
    return this.notes.findOne({ where: { supersedesId: id, archivedAt: IsNull() } })
  }

  private async find(id: string): Promise<NoteEntity> {
    const note = /^[0-9a-f-]{36}$/i.test(id) ? await this.notes.findOne({ where: { id } }) : null

    if (!note) throw new NotFoundException('Note not found')

    return note
  }

  private async linkedTasks(refs: string[], viewer: IViewer): Promise<INoteDetailPayload['tasks']> {
    const numbers = refs.map(ref => TASK_REF.exec(ref)?.[1]).filter((n): n is string => Boolean(n))

    if (!numbers.length) return []

    const rows: Array<{ id: string, task_no: string, title: string, status: string, assignee_id: string | null, author_id: string }> = await this.notes.query(
      `select id, task_no, title, status, assignee_id, author_id from tasks where task_no = any($1::bigint[]) order by task_no`,
      [numbers],
    )

    return rows
      .filter(row => canSeeTask(viewer, { assigneeId: row.assignee_id, authorId: row.author_id }))
      .map(row => ({ uuid: row.id, key: taskKey(row.task_no), title: row.title, status: row.status }))
  }

  private async linkedNotes(refs: string[], self: string): Promise<INoteDetailPayload['notes']> {
    const codes = refs.map(ref => NOTE_REF.exec(ref)).filter((match): match is RegExpExecArray => Boolean(match))

    if (!codes.length) return []

    const kinds = codes.map(match => ({ NOTE: NoteKind.Note, DEC: NoteKind.Decision, DIR: NoteKind.Directive })[match[1] as 'NOTE' | 'DEC' | 'DIR'])
    const rows: Array<{ id: string, kind: string, kind_no: number, title: string }> = await this.notes.query(
      `select id, kind, kind_no, title from notes
        where id <> $3 and (kind, kind_no) in (select * from unnest($1::text[], $2::int[]))
        order by kind, kind_no`,
      [kinds, codes.map(match => Number(match[2])), self],
    )

    return rows.map(row => ({ uuid: row.id, key: noteKey(row.kind, row.kind_no), kind: row.kind, title: row.title }))
  }

  private async people(ids: Array<string | null>): Promise<Map<string, IPerson>> {
    const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))]

    if (!wanted.length) return new Map()

    const rows = await this.users.find({ where: { id: In(wanted) }, select: { id: true, firstName: true, lastName: true, email: true } })

    return new Map(rows.map(row => [row.id, { uuid: row.id, name: nameOf(row) }]))
  }

  private async payloads(rows: NoteEntity[], viewer: IViewer): Promise<INotePayload[]> {
    if (!rows.length) return []

    const ids = rows.map(row => row.id)
    const people = await this.people(rows.map(row => row.authorId))
    const replacing = await this.notes.find({ where: { supersedesId: In(ids), archivedAt: IsNull() } })
    const replaced = await this.notes.find({ where: { id: In(rows.map(row => row.supersedesId).filter((id): id is string => Boolean(id))) } })
    const counts: Array<{ note_id: string, total: number, done: number, mine: string | null }> = await this.acks.query(
      `select note_id, count(*)::int as total, count(acknowledged_at)::int as done,
              max(case when user_id = $2 then (case when acknowledged_at is null then 'pending' else 'done' end) end) as mine
         from note_acks where note_id = any($1::uuid[]) group by note_id`,
      [ids, viewer.id],
    )
    const ackBy = new Map(counts.map(row => [row.note_id, row]))
    const refOf = (note: NoteEntity): INoteRef => ({ uuid: note.id, key: noteKey(note.kind, note.kindNo) })

    return rows.map((row) => {
      const ack = ackBy.get(row.id)
      const successor = replacing.find(note => note.supersedesId === row.id)
      const predecessor = replaced.find(note => note.id === row.supersedesId)

      return {
        uuid: row.id,
        key: noteKey(row.kind, row.kindNo),
        kind: row.kind,
        title: row.title,
        excerpt: excerptOf(row.body),
        author: people.get(row.authorId) ?? null,
        refs: row.refs,
        supersedes: predecessor ? refOf(predecessor) : null,
        superseded_by: successor ? refOf(successor) : null,
        acks: row.kind === NoteKind.Directive
          ? { total: ack?.total ?? 0, done: ack?.done ?? 0, mine: (ack?.mine as INoteAcks['mine']) ?? null }
          : null,
        archived_at: row.archivedAt?.toISOString() ?? null,
        created_at: row.createdAt.toISOString(),
        updated_at: row.updatedAt.toISOString(),
      }
    })
  }
}
