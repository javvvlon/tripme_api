import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export type IokaQuery = Record<string, string | number>

export interface IIokaSource {
  get(path: string, query: IokaQuery): Promise<unknown>
}

const TIMEOUT_MS = 15_000

export class HttpIokaSource implements IIokaSource {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string | null,
  ) {}

  async get(path: string, query: IokaQuery): Promise<unknown> {
    const url = new URL(this.baseUrl.replace(/\/+$/, '') + path)

    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value))

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TripMe/1.0 (+https://tripme.uz)',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!response.ok) throw new Error(`ioka ${path} answered ${response.status}`)

    return response.json()
  }
}

export class FixtureIokaSource implements IIokaSource {
  constructor(private readonly dir: string) {}

  async get(path: string, query: IokaQuery): Promise<unknown> {
    const file = path.endsWith('/countries')
      ? 'countries.json'
      : `packages-${String(query.country_code ?? '').toLowerCase()}.json`

    try {
      return JSON.parse(await readFile(join(this.dir, file), 'utf8'))
    }
    catch {
      return { items: [], totals: 0 }
    }
  }
}
