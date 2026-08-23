import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ISupplierTransport } from './contracts'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class HttpTransport implements ISupplierTransport {
  async fetch(url: string, init?: { signal?: AbortSignal, headers?: Record<string, string> }): Promise<string> {
    const response = await globalThis.fetch(url, {
      signal: init?.signal,
      headers: init?.headers,
    })

    if (!response.ok) {
      throw new Error(`supplier responded ${response.status} for ${new URL(url).pathname}`)
    }

    return response.text()
  }
}

/**
 * Replays a saved response instead of calling anyone.
 *
 * This is how the whole system runs before a single supplier has agreed to
 * give us access, and how the parser is tested without depending on someone
 * else's uptime or their current markup.
 */
export class FixtureTransport implements ISupplierTransport {
  constructor(
    private readonly dir: string,
    /** page number → file name; a missing page means the listing ended */
    private readonly pages: Record<number, string>,
  ) {}

  async fetch(url: string): Promise<string> {
    const page = Number(new URL(url, 'https://fixture.local').searchParams.get('PRICEPAGE') ?? 1)
    const file = this.pages[page]

    // No fixture for this page = the listing ended. Returning empty makes the
    // short-page stop condition fire naturally, exercising the real code path.
    if (!file) return ''

    return readFile(join(this.dir, file), 'utf8')
  }
}
