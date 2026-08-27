import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ISupplierTransport } from './contracts'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class HttpTransport implements ISupplierTransport {
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

    if (!body.trim()) {
      throw new Error('supplier returned an empty body')
    }

    return body
  }
}

export class FixtureTransport implements ISupplierTransport {
  constructor(
    private readonly dir: string,
    private readonly pages: Record<number, string>,
  ) {}

  async fetch(url: string): Promise<string> {
    const page = Number(new URL(url, 'https://fixture.local').searchParams.get('PRICEPAGE') ?? 1)
    const file = this.pages[page]

    if (!file) return ''

    return readFile(join(this.dir, file), 'utf8')
  }
}
