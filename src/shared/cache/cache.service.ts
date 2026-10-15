import { gunzipSync, gzipSync } from 'node:zlib'
import { Injectable, Logger } from '@nestjs/common'
import type { OnModuleDestroy } from '@nestjs/common'
import { MemoryStore, RedisStore } from './cache.store'
import type { ICacheStore } from './cache.store'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const PACKED = 'gz:'

export const packText = (text: string): string => PACKED + gzipSync(text).toString('base64')

export const unpackText = (stored: string): string =>
  stored.startsWith(PACKED) ? gunzipSync(Buffer.from(stored.slice(PACKED.length), 'base64')).toString('utf8') : stored

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name)

  readonly store: ICacheStore

  constructor() {
    const url = process.env.REDIS_URL?.trim()

    this.store = url ? new RedisStore(url) : new MemoryStore()
    this.logger.log(`cache: ${this.store.kind}`)
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.store.get(key)

    if (raw === null) return null

    try {
      return JSON.parse(unpackText(raw)) as T
    }
    catch {
      return null
    }
  }

  async setJson(key: string, value: unknown, ttlMs: number): Promise<void> {
    await this.store.set(key, packText(JSON.stringify(value)), ttlMs)
  }

  async getText(key: string): Promise<string | null> {
    const raw = await this.store.get(key)

    if (raw === null) return null

    try {
      return unpackText(raw)
    }
    catch {
      return null
    }
  }

  async setText(key: string, value: string, ttlMs: number): Promise<void> {
    await this.store.set(key, packText(value), ttlMs)
  }

  async onModuleDestroy(): Promise<void> {
    await this.store.close()
  }
}
