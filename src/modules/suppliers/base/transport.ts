import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ISupplierTransport } from './contracts'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class HttpTransport implements ISupplierTransport {
  /**
   * Timeout, not patience. A supplier that has not answered in 30s is not
   * about to, and an agent watching a spinner has already moved on — §4 wants
   * first results in seconds, and the status row exists to say who is late.
   */
  constructor(private readonly timeoutMs = 30_000) {}

  async fetch(url: string, init?: { signal?: AbortSignal, headers?: Record<string, string> }): Promise<string> {
    const timeout = AbortSignal.timeout(this.timeoutMs)
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout

    const response = await globalThis.fetch(url, {
      signal,
      headers: init?.headers,
      redirect: 'follow',
    })

    if (!response.ok) {
      throw new Error(`supplier responded ${response.status} for ${new URL(url).pathname}`)
    }

    const body = await response.text()

    // A 200 that is actually a login page or an error is worse than a 500,
    // because it parses to zero rows and looks like "no availability".
    if (!body.trim()) {
      throw new Error('supplier returned an empty body')
    }

    return body
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
