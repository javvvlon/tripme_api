import { Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export type MediaUseKind = 'post' | 'list' | 'section' | 'banner'

export interface IMediaUse {
  kind: MediaUseKind
  id: string
  label: string
  page: string | null
}

interface IUseRow {
  id: string
  label: string | null
  page: string | null
  text: string | null
}

const SOURCES: Array<{ kind: MediaUseKind, sql: string }> = [
  {
    kind: 'post',
    sql: `select p.id, coalesce((select nullif(title, '') from post_translations where post_id = p.id and locale = 'ru'), p.slug) as label,
            null as page, concat_ws(' ', p.image_url, (select string_agg(body, ' ') from post_translations where post_id = p.id)) as text
          from posts p`,
  },
  {
    kind: 'list',
    sql: `select l.id, l.name as label, null as page, string_agg(coalesce(i.image_url, ''), ' ') as text
          from content_lists l join content_items i on i.list_id = l.id
          group by l.id, l.name`,
  },
  {
    kind: 'section',
    sql: `select s.id, coalesce((select nullif(title, '') from content_section_translations where section_id = s.id and locale = 'ru'), s.kind) as label,
            s.page, concat_ws(' ', s.settings::text, (select string_agg(coalesce(body, ''), ' ') from content_section_translations where section_id = s.id)) as text
          from content_sections s`,
  },
  {
    kind: 'banner',
    sql: `select b.id, null as label, b.page, string_agg(coalesce(t.image_url, ''), ' ') as text
          from content_banners b join content_banner_translations t on t.banner_id = b.id
          group by b.id, b.page`,
  },
]

export function usesOf(paths: string[], rows: Array<IMediaUse & { text: string }>): Map<string, IMediaUse[]> {
  const found = new Map<string, IMediaUse[]>()

  for (const path of paths) {
    const uses = rows
      .filter(row => row.text.includes(path))
      .map(({ text: _text, ...use }) => use)

    if (uses.length) found.set(path, uses)
  }

  return found
}

@Injectable()
export class MediaUsageService {
  constructor(private readonly dataSource: DataSource) {}

  async of(paths: string[]): Promise<Map<string, IMediaUse[]>> {
    if (!paths.length) return new Map()

    const rows: Array<IMediaUse & { text: string }> = []

    for (const source of SOURCES) {
      const found = await this.dataSource.query<IUseRow[]>(source.sql)

      for (const row of found) {
        if (!row.text) continue

        rows.push({ kind: source.kind, id: row.id, label: row.label ?? '', page: row.page, text: row.text })
      }
    }

    return usesOf(paths, rows)
  }
}
