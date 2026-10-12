import { describe, expect, it } from 'vitest'
import { usesOf } from './media-usage.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const row = (kind: 'post' | 'list' | 'section' | 'banner', id: string, text: string) =>
  ({ kind, id, label: id, page: null, text })

describe('usesOf', () => {
  it('finds every place that holds a file, by its storage path', () => {
    const uses = usesOf(['content/a.jpg', 'content/b.jpg', 'content/c.jpg'], [
      row('post', 'p1', 'https://x/storage/v1/object/public/b/content/a.jpg ![x](https://x/storage/v1/object/public/b/content/b.jpg)'),
      row('list', 'l1', ' https://x/storage/v1/object/public/b/content/a.jpg'),
      row('section', 's1', '{"image_url": null}'),
    ])

    expect(uses.get('content/a.jpg')?.map(use => use.id)).toEqual(['p1', 'l1'])
    expect(uses.get('content/b.jpg')?.map(use => use.kind)).toEqual(['post'])
    expect(uses.has('content/c.jpg')).toBe(false)
  })

  it('does not leak the searched text', () => {
    const uses = usesOf(['content/a.jpg'], [row('banner', 'b1', 'content/a.jpg')])

    expect(uses.get('content/a.jpg')?.[0]).toEqual({ kind: 'banner', id: 'b1', label: 'b1', page: null })
  })
})
