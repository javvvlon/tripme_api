import { describe, expect, it } from 'vitest'
import { StorageService, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from './storage.service'
import { ALLOWED_ATTACHMENTS, MAX_ATTACHMENT_BYTES } from '~/modules/orders/documents/documents.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const file = (mimetype: string, size = 1024) => ({
  buffer: Buffer.alloc(1),
  mimetype,
  originalname: 'file',
  size,
})

const storage = () => new StorageService()

describe('upload limits', () => {
  it('takes a pdf when the caller asked for documents', async () => {
    await expect(
      storage().upload(file('application/pdf'), 'documents', {
        allowed: ALLOWED_ATTACHMENTS,
        maxBytes: MAX_ATTACHMENT_BYTES,
      }),
    ).rejects.toThrow(/storage is not configured|Could not store/)
  })

  it('still takes images only when nothing is asked for', async () => {
    await expect(storage().upload(file('application/pdf'), 'content'))
      .rejects.toThrow('Unsupported file type application/pdf')
  })

  it('refuses what no caller allows', async () => {
    await expect(
      storage().upload(file('application/x-msdownload'), 'documents', {
        allowed: ALLOWED_ATTACHMENTS,
        maxBytes: MAX_ATTACHMENT_BYTES,
      }),
    ).rejects.toThrow('Unsupported file type application/x-msdownload')
  })

  it('holds each caller to its own size', async () => {
    const tenMegabytes = 10 * 1024 * 1024

    await expect(storage().upload(file('image/png', tenMegabytes), 'content'))
      .rejects.toThrow('File is larger than 8MB')

    await expect(
      storage().upload(file('application/pdf', 20 * 1024 * 1024), 'documents', {
        allowed: ALLOWED_ATTACHMENTS,
        maxBytes: MAX_ATTACHMENT_BYTES,
      }),
    ).rejects.toThrow('File is larger than 15MB')
  })

  it('keeps the two lists apart', () => {
    expect(ALLOWED_IMAGE_TYPES).not.toContain('application/pdf')
    expect(ALLOWED_ATTACHMENTS).toContain('application/pdf')
    expect(MAX_ATTACHMENT_BYTES).toBeGreaterThan(MAX_IMAGE_BYTES)
  })
})
