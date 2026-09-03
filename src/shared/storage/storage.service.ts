import { randomUUID } from 'node:crypto'
import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { DeleteObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/avif'] as const

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024

export interface IStoredFile {
  url: string
  path: string
  title: string
  folder_id: string | null
  size: number
  uploaded_at: string | null
}

/**
 * What a caller will accept. The bucket holds more than pictures now, and
 * the rules belong to whoever is storing the file rather than to the store.
 */
export interface IUploadLimits {
  allowed?: readonly string[]
  maxBytes?: number
}

export interface IUploadedFile {
  buffer: Buffer
  mimetype: string
  originalname: string
  size: number
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)

  private readonly bucket = process.env.SUPABASE_BUCKET ?? 'tripme_content'
  private readonly endpoint = process.env.SUPABASE_S3_ENDPOINT
  private readonly region = process.env.SUPABASE_S3_REGION ?? 'ap-southeast-1'
  private readonly accessKeyId = process.env.SUPABASE_S3_ACCESS_KEY_ID
  private readonly secretAccessKey = process.env.SUPABASE_S3_SECRET_ACCESS_KEY

  private client: S3Client | null = null

  /**
   * The origin public URLs are built from. Derived from DATABASE_URL when
   * unset — reads go through the CDN host, not the S3 endpoint.
   */
  private get publicOrigin(): string | null {
    if (process.env.SUPABASE_URL) return process.env.SUPABASE_URL.replace(/\/$/, '')

    const ref = /postgres\.([a-z0-9]+):/.exec(process.env.DATABASE_URL ?? '')?.[1]

    return ref ? `https://${ref}.supabase.co` : null
  }

  get configured(): boolean {
    return Boolean(this.endpoint && this.accessKeyId && this.secretAccessKey && this.publicOrigin)
  }

  private s3(): S3Client {
    if (this.client) return this.client

    if (!this.endpoint || !this.accessKeyId || !this.secretAccessKey) {
      throw new ServiceUnavailableException(
        'File storage is not configured — see SUPABASE_S3_ACCESS_KEY_ID',
      )
    }

    this.client = new S3Client({
      endpoint: this.endpoint,
      region: this.region,
      credentials: { accessKeyId: this.accessKeyId, secretAccessKey: this.secretAccessKey },
      /**
       * Supabase serves one bucket per path, not per subdomain. Without this
       * the SDK addresses `tripme_content.<host>`, which does not resolve.
       */
      forcePathStyle: true,
    })

    return this.client
  }

  async upload(
    file: IUploadedFile,
    folder = 'content',
    limits: IUploadLimits = {},
  ): Promise<{ url: string, path: string }> {
    const allowed = limits.allowed ?? ALLOWED_IMAGE_TYPES
    const maxBytes = limits.maxBytes ?? MAX_IMAGE_BYTES

    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type ${file.mimetype}`)
    }

    if (file.size > maxBytes) {
      throw new BadRequestException(`File is larger than ${Math.round(maxBytes / 1024 / 1024)}MB`)
    }

    /**
     * Checked before the attempt, not inside the catch below, so that a
     * missing key reads as a missing key rather than as storage being down.
     */
    if (!this.configured) {
      throw new ServiceUnavailableException(
        'File storage is not configured — see SUPABASE_S3_ACCESS_KEY_ID in .env',
      )
    }

    const origin = this.publicOrigin!

    /**
     * A generated name, not the editor's. Two people uploading `banner.jpg`
     * must not overwrite each other, and a filename someone typed is a path
     * traversal waiting to happen.
     */
    const path = `${folder}/${randomUUID()}${extension(file.originalname, file.mimetype)}`

    try {
      await this.s3().send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: path,
        Body: file.buffer,
        ContentType: file.mimetype,
        // The name carries a UUID, so the bytes at a URL never change.
        CacheControl: 'public, max-age=31536000, immutable',
      }))
    }
    catch (error) {
      this.logger.error(`upload failed: ${String(error)}`)
      throw new ServiceUnavailableException('Could not store the file')
    }

    return { path, url: `${origin}/storage/v1/object/public/${this.bucket}/${path}` }
  }

  async list(folder = 'content', limit = 200): Promise<IStoredFile[]> {
    if (!this.configured || !this.publicOrigin) return []

    const origin = this.publicOrigin

    try {
      const response = await this.s3().send(new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: `${folder}/`,
        MaxKeys: limit,
      }))

      return (response.Contents ?? [])
        .filter(object => Boolean(object.Key) && !object.Key!.endsWith('/'))
        .sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0))
        .map(object => ({
          path: object.Key!,
          url: `${origin}/storage/v1/object/public/${this.bucket}/${object.Key}`,
          title: '',
          folder_id: null,
          size: object.Size ?? 0,
          uploaded_at: object.LastModified ? object.LastModified.toISOString() : null,
        }))
    }
    catch (error) {
      this.logger.warn(`could not list ${folder}: ${String(error)}`)

      return []
    }
  }

  keyOf(publicUrl: string): string | null {
    const marker = `/storage/v1/object/public/${this.bucket}/`
    const at = publicUrl.indexOf(marker)

    return at === -1 ? null : publicUrl.slice(at + marker.length)
  }

  async remove(publicUrl: string): Promise<void> {
    if (!this.configured) return

    const key = this.keyOf(publicUrl)

    if (!key) return

    try {
      await this.s3().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
    }
    catch (error) {
      this.logger.warn(`could not remove ${publicUrl}: ${String(error)}`)
    }
  }
}

function extension(name: string, mimetype: string): string {
  const fromName = /\.[a-z0-9]{2,5}$/i.exec(name)?.[0]

  if (fromName) return fromName.toLowerCase()

  return { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/avif': '.avif' }[mimetype] ?? ''
}
