import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import sharp from 'sharp'
import { GeminiClient } from '~/shared/ai/gemini.client'
import type { IGeminiImage } from '~/shared/ai/gemini.client'
import type { IChatTurn } from '~/shared/ai/chat'
import { StorageService } from '~/shared/storage/storage.service'
import { MediaService } from '~/shared/storage/media.service'
import { IMAGE_FOLDER, closestRatio, generationPrompt, imagePrompt, imageSizeFor, imageSpecOf, imageSystem } from './image.studio'
import type { IImageSpec, ImageFormat, ImageRatio } from './image.studio'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IImageRequest {
  text: string
  history: IChatTurn[]
  reference: IGeminiImage | null
}

export interface IGeneratedImage {
  url: string
  width: number
  height: number
  ratio: ImageRatio
  format: ImageFormat
  title: string
}

export interface IImageAnswer {
  reply: string
  prompt: string
  images: IGeneratedImage[]
  failed: number
  suggestions: string[]
}

const MIME: Record<ImageFormat, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

const EXTENSION: Record<ImageFormat, string> = { jpeg: 'jpg', png: 'png', webp: 'webp' }

export async function fitImage(data: Buffer, width: number, height: number, format: ImageFormat): Promise<Buffer> {
  const image = sharp(data).rotate().resize(width, height, { fit: 'cover', position: 'attention' })

  if (format === 'png') return image.png({ compressionLevel: 9 }).toBuffer()
  if (format === 'webp') return image.webp({ quality: 88 }).toBuffer()

  return image.jpeg({ quality: 88, mozjpeg: true }).toBuffer()
}

@Injectable()
export class ImageStudioService {
  private readonly logger = new Logger(ImageStudioService.name)

  constructor(
    private readonly gemini: GeminiClient,
    private readonly storage: StorageService,
    private readonly media: MediaService,
  ) {}

  async create(request: IImageRequest): Promise<IImageAnswer> {
    if (!this.gemini.configured) throw new ServiceUnavailableException('GEMINI_API_KEY is not set')
    if (!this.storage.configured) throw new ServiceUnavailableException('File storage is not configured')

    const references = request.reference ? [request.reference] : []
    const spec = imageSpecOf(await this.gemini.json<unknown>(imageSystem(), imagePrompt(request.text, request.history), { images: references, temperature: 0.4 }))

    if (!spec) throw new BadGatewayException('Gemini did not describe the image')

    const ratio = closestRatio(spec.width, spec.height)
    const folder = await this.media.createFolder(IMAGE_FOLDER).catch(() => null)
    const results = await Promise.allSettled(Array.from({ length: spec.count }, (_, index) => this.render(spec, ratio, references, folder?.id ?? null, index)))
    const images = results.flatMap(result => (result.status === 'fulfilled' ? [result.value] : []))
    const failures = results.flatMap(result => (result.status === 'rejected' ? [result.reason as unknown] : []))

    for (const failure of failures) this.logger.warn(`image failed: ${String(failure)}`)

    if (!images.length) throw failures[0] ?? new BadGatewayException('Gemini returned no image')

    return { reply: spec.reply, prompt: spec.prompt, images, failed: failures.length, suggestions: spec.suggestions }
  }

  private async render(spec: IImageSpec, ratio: ImageRatio, references: IGeminiImage[], folderId: string | null, index: number): Promise<IGeneratedImage> {
    const raw = await this.gemini.image(generationPrompt(spec, ratio, spec.width, spec.height), ratio, {
      imageSize: imageSizeFor(spec.width, spec.height),
      references,
    })
    const buffer = await fitImage(raw.data, spec.width, spec.height, spec.format)
    const stored = await this.storage.upload({
      buffer,
      mimetype: MIME[spec.format],
      originalname: `tripme-ai.${EXTENSION[spec.format]}`,
      size: buffer.length,
    }, 'content', { maxBytes: 16 * 1024 * 1024 })
    const title = spec.count > 1 ? `${spec.title} · ${index + 1}` : spec.title

    await this.media.describe(stored.url, { title, folder: folderId }).catch((error: unknown) => {
      this.logger.warn(`generated image not filed: ${String(error)}`)
    })

    return { url: stored.url, width: spec.width, height: spec.height, ratio, format: spec.format, title }
  }
}
