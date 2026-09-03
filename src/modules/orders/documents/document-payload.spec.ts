import { describe, expect, it } from 'vitest'
import { toDocumentPayload } from './documents.service'
import { DocumentKind, OrderDocumentEntity } from '../order-document.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const row = (over: Partial<OrderDocumentEntity> = {}): OrderDocumentEntity => ({
  id: 'doc-1',
  orderId: 'order-1',
  kind: DocumentKind.Offer,
  name: 'КП-305.pdf',
  path: 'documents/abc.pdf',
  url: 'https://example.test/documents/abc.pdf',
  size: 31742,
  createdBy: 'user-1',
  createdAt: new Date('2026-09-03T09:14:41.623Z'),
  ...over,
} as OrderDocumentEntity)

describe('document payload', () => {
  it('says exactly what the CMS reads', () => {
    expect(Object.keys(toDocumentPayload(row())).sort()).toEqual(
      ['created_at', 'id', 'kind', 'name', 'order_id', 'size', 'url'],
    )
  })

  it('lets nothing camelCase through', () => {
    /** `createdAt` reaching the page is what froze it on "Загружаем…". */
    const keys = Object.keys(toDocumentPayload(row()))

    expect(keys.filter(key => /[A-Z]/.test(key))).toEqual([])
  })

  it('gives a date the page can parse', () => {
    const made = toDocumentPayload(row())

    expect(Number.isNaN(new Date(made.created_at).getTime())).toBe(false)
  })

  it('never leaks the storage key', () => {
    expect(toDocumentPayload(row())).not.toHaveProperty('path')
  })

  it('reads a size that arrived as a string', () => {
    expect(toDocumentPayload(row({ size: '31742' as never })).size).toBe(31742)
  })
})
