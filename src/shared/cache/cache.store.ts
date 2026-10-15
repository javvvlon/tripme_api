import Redis from 'ioredis'
import { Logger } from '@nestjs/common'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface ICacheStore {
  readonly kind: 'redis' | 'memory'
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlMs: number): Promise<void>
  close(): Promise<void>
}

export class MemoryStore implements ICacheStore {
  readonly kind = 'memory' as const

  private readonly entries = new Map<string, { value: string, until: number }>()

  constructor(private readonly maxEntries = 2000) {}

  async get(key: string): Promise<string | null> {
    const entry = this.entries.get(key)

    if (!entry) return null

    if (entry.until <= Date.now()) {
      this.entries.delete(key)
      return null
    }

    return entry.value
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    this.entries.delete(key)
    this.entries.set(key, { value, until: Date.now() + ttlMs })

    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value

      if (oldest === undefined) break

      this.entries.delete(oldest)
    }
  }

  async close(): Promise<void> {
    this.entries.clear()
  }
}

export class RedisStore implements ICacheStore {
  readonly kind = 'redis' as const

  private readonly logger = new Logger('RedisStore')
  private readonly client: Redis
  private warned = false

  constructor(url: string) {
    this.client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 5000,
    })

    this.client.on('error', (error) => {
      if (this.warned) return

      this.warned = true
      this.logger.warn(`redis unavailable, cache misses until it is back: ${String(error)}`)
    })

    this.client.on('ready', () => {
      this.warned = false
      this.logger.log('redis connected')
    })
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key)
    }
    catch {
      return null
    }
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    try {
      await this.client.set(key, value, 'PX', Math.max(1, Math.round(ttlMs)))
    }
    catch {}
  }

  async close(): Promise<void> {
    this.client.disconnect()
  }
}
