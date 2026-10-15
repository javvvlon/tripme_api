import { describe, expect, it, vi } from 'vitest'
import { MemoryStore } from './cache.store'
import { packText, unpackText } from './cache.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
describe('MemoryStore', () => {
  it('forgets an entry once its time is up', async () => {
    vi.useFakeTimers()
    const store = new MemoryStore()

    await store.set('k', 'v', 1000)
    expect(await store.get('k')).toBe('v')

    vi.advanceTimersByTime(1001)
    expect(await store.get('k')).toBeNull()
    vi.useRealTimers()
  })

  it('drops the oldest entries past its size', async () => {
    const store = new MemoryStore(2)

    await store.set('a', '1', 60_000)
    await store.set('b', '2', 60_000)
    await store.set('c', '3', 60_000)

    expect(await store.get('a')).toBeNull()
    expect(await store.get('c')).toBe('3')
  })
})

describe('packText', () => {
  it('round-trips through gzip and reads plain values as they are', () => {
    const html = '<select name="TOWNFROMINC"><option>Ташкент</option></select>'.repeat(50)

    expect(packText(html).length).toBeLessThan(html.length)
    expect(unpackText(packText(html))).toBe(html)
    expect(unpackText('plain')).toBe('plain')
  })
})
