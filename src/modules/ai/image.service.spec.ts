import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { ImageStudioService, fitImage } from './image.service'
import type { GeminiClient, IGeminiImage, IImageOptions } from '~/shared/ai/gemini.client'
import type { StorageService } from '~/shared/storage/storage.service'
import type { MediaService } from '~/shared/storage/media.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const png = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 230, g: 220, b: 200 } } }).png().toBuffer()

describe('fitImage', () => {
  it('crops and resizes to the exact pixels in the asked format', async () => {
    const fitted = await fitImage(await png(1536, 672), 1920, 765, 'jpeg')
    const meta = await sharp(fitted).metadata()

    expect([meta.width, meta.height, meta.format]).toEqual([1920, 765, 'jpeg'])
    expect((await sharp(await fitImage(await png(1024, 1024), 1080, 1920, 'webp')).metadata()).format).toBe('webp')
  })
})

describe('ImageStudioService', () => {
  it('plans, generates, fits and files every variant', async () => {
    const asked: Array<{ ratio: string, options?: IImageOptions }> = []
    const uploads: Array<{ size: number, mimetype: string }> = []
    const filed: Array<{ title?: string, folder?: string | null }> = []

    const gemini = {
      configured: true,
      imageModel: 'test-image',
      json: async () => ({ prompt: 'Soft palm leaf shadows on warm sand', title: 'Листья · 1920×765', width: 1920, height: 765, count: 2, reply: 'Готово', suggestions: ['Ещё вариант'] }),
      image: async (_prompt: string, ratio: string, options?: IImageOptions): Promise<IGeminiImage> => {
        asked.push({ ratio, options })

        return { mimeType: 'image/png', data: await png(1536, 672) }
      },
    } as unknown as GeminiClient
    const storage = {
      configured: true,
      upload: async (file: { size: number, mimetype: string }) => {
        uploads.push(file)

        return { url: `https://cdn.test/${uploads.length}.jpg`, path: `content/${uploads.length}.jpg` }
      },
    } as unknown as StorageService
    const media = {
      createFolder: async () => ({ id: 'folder-1', name: 'TripMe AI', count: 0 }),
      describe: async (_url: string, changes: { title?: string, folder?: string | null }) => {
        filed.push(changes)

        return { path: '', title: changes.title ?? '', folder_id: changes.folder ?? null }
      },
    } as unknown as MediaService

    const answer = await new ImageStudioService(gemini, storage, media).create({ text: 'Сгенерируй 2 фона для главного экрана', history: [], reference: null })

    expect(asked.map(call => call.ratio)).toEqual(['21:9', '21:9'])
    expect(asked[0]!.options?.imageSize).toBe('2K')
    expect(uploads.every(file => file.mimetype === 'image/jpeg')).toBe(true)
    expect(filed).toHaveLength(2)
    expect(filed).toEqual(expect.arrayContaining([{ title: 'Листья · 1920×765 · 1', folder: 'folder-1' }, { title: 'Листья · 1920×765 · 2', folder: 'folder-1' }]))
    expect(answer.images.map(image => image.title)).toEqual(['Листья · 1920×765 · 1', 'Листья · 1920×765 · 2'])
    expect(answer.images.map(image => [image.width, image.height, image.ratio])).toEqual([[1920, 765, '21:9'], [1920, 765, '21:9']])
    expect(answer).toMatchObject({ reply: 'Готово', failed: 0, suggestions: ['Ещё вариант'] })
  })
})
