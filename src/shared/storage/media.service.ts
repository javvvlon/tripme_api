import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { MediaTitleEntity } from './media-title.entity'
import { StorageService } from './storage.service'
import type { IStoredFile } from './storage.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const MAX_TITLE_LENGTH = 120

@Injectable()
export class MediaService {
  constructor(
    private readonly storage: StorageService,
    @InjectRepository(MediaTitleEntity)
    private readonly titles: Repository<MediaTitleEntity>,
  ) {}

  /**
   * Searches the name the editor gave a file, falling back to the stored
   * key — a file nobody has named is still findable by what it was called
   * when it landed.
   */
  async library(query = ''): Promise<IStoredFile[]> {
    const files = await this.storage.list()

    if (!files.length) return files

    const stored = await this.titles.find({ where: { path: In(files.map(file => file.path)) } })
    const byPath = new Map(stored.map(row => [row.path, row.title]))

    const named = files.map(file => ({ ...file, title: byPath.get(file.path) ?? '' }))
    const needle = query.trim().toLowerCase()

    if (!needle) return named

    return named.filter(file =>
      file.title.toLowerCase().includes(needle) || file.path.toLowerCase().includes(needle))
  }

  /**
   * Names a file without moving it. The object key stays as uploaded, so
   * every banner, list and article already pointing at this URL keeps
   * working — a rename that changed the key would break all of them.
   */
  async rename(url: string, title: string): Promise<{ path: string, title: string }> {
    const path = this.storage.keyOf(url)

    if (!path) throw new BadRequestException('That URL is not a stored file')

    const trimmed = title.trim().slice(0, MAX_TITLE_LENGTH)

    if (trimmed) await this.titles.save({ path, title: trimmed })
    else await this.titles.delete({ path })

    return { path, title: trimmed }
  }

  async remove(url: string): Promise<void> {
    const path = this.storage.keyOf(url)

    await this.storage.remove(url)

    if (path) await this.titles.delete({ path })
  }
}
