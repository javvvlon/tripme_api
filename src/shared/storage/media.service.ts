import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, IsNull, Not, Repository } from 'typeorm'
import { MediaFileEntity } from './media-file.entity'
import { MediaFolderEntity } from './media-folder.entity'
import { StorageService } from './storage.service'
import type { IStoredFile } from './storage.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const MAX_TITLE_LENGTH = 120

export const MAX_FOLDER_NAME = 60

/** The filter a caller can ask for instead of a folder id. */
export const UNFILED = 'none'

export interface IMediaFolder {
  id: string
  name: string
  count: number
}

@Injectable()
export class MediaService {
  constructor(
    private readonly storage: StorageService,
    @InjectRepository(MediaFileEntity)
    private readonly files: Repository<MediaFileEntity>,
    @InjectRepository(MediaFolderEntity)
    private readonly folders: Repository<MediaFolderEntity>,
  ) {}

  /**
   * Every folder, with how many files sit in it.
   *
   * Counted from the rows rather than the bucket: a row can outlive its file
   * only briefly, and an approximate count is worth more than a second
   * listing of the whole bucket on every open.
   */
  async folderList(): Promise<IMediaFolder[]> {
    const folders = await this.folders.find({ order: { name: 'ASC' } })

    if (!folders.length) return []

    const counts = await this.files
      .createQueryBuilder('file')
      .select('file.folder_id', 'id')
      .addSelect('count(*)', 'count')
      .where('file.folder_id is not null')
      .groupBy('file.folder_id')
      .getRawMany<{ id: string, count: string }>()

    const byId = new Map(counts.map(row => [row.id, Number(row.count)]))

    return folders.map(folder => ({
      id: folder.id,
      name: folder.name,
      count: byId.get(folder.id) ?? 0,
    }))
  }

  async createFolder(name: string): Promise<IMediaFolder> {
    const trimmed = this.folderName(name)

    const existing = await this.folders.findOne({ where: { name: trimmed } })

    if (existing) return { id: existing.id, name: existing.name, count: 0 }

    const saved = await this.folders.save(this.folders.create({ name: trimmed }))

    return { id: saved.id, name: saved.name, count: 0 }
  }

  async renameFolder(id: string, name: string): Promise<IMediaFolder> {
    const folder = await this.folders.findOne({ where: { id } })

    if (!folder) throw new NotFoundException('Folder not found')

    folder.name = this.folderName(name)

    await this.folders.save(folder)

    return { id: folder.id, name: folder.name, count: 0 }
  }

  /**
   * Drops the folder, not the files in it.
   *
   * The foreign key clears `folder_id` on the way out, so everything filed
   * here goes back to being unfiled rather than disappearing with it.
   */
  async removeFolder(id: string): Promise<void> {
    const gone = await this.folders.delete({ id })

    if (!gone.affected) throw new NotFoundException('Folder not found')

    /**
     * The files that lived here now have an empty row each — no name, no
     * folder. Nothing reads them, so they go rather than accumulating one
     * per deleted folder.
     */
    await this.files.delete({ title: '', folderId: IsNull() })
  }

  /**
   * Searches the name the editor gave a file, falling back to the stored
   * key — a file nobody has named is still findable by what it was called
   * when it landed.
   */
  async library(query = '', folder = ''): Promise<IStoredFile[]> {
    const files = await this.storage.list()

    if (!files.length) return files

    const rows = await this.files.find({ where: { path: In(files.map(file => file.path)) } })
    const byPath = new Map(rows.map(row => [row.path, row]))

    let named = files.map(file => ({
      ...file,
      title: byPath.get(file.path)?.title ?? '',
      folder_id: byPath.get(file.path)?.folderId ?? null,
    }))

    if (folder === UNFILED) named = named.filter(file => !file.folder_id)
    else if (folder) named = named.filter(file => file.folder_id === folder)

    const needle = query.trim().toLowerCase()

    if (!needle) return named

    return named.filter(file =>
      file.title.toLowerCase().includes(needle) || file.path.toLowerCase().includes(needle))
  }

  /**
   * Names a file and files it, without moving it.
   *
   * The object key stays as uploaded, so every banner, list and article
   * already pointing at this URL keeps working — a folder that was part of
   * the path would break all of them the moment a file was moved.
   */
  async describe(
    url: string,
    changes: { title?: string, folder?: string | null },
  ): Promise<{ path: string, title: string, folder_id: string | null }> {
    const path = this.storage.keyOf(url)

    if (!path) throw new BadRequestException('That URL is not a stored file')

    const held = await this.files.findOne({ where: { path } })

    const title = changes.title === undefined
      ? held?.title ?? ''
      : changes.title.trim().slice(0, MAX_TITLE_LENGTH)

    const folderId = changes.folder === undefined
      ? held?.folderId ?? null
      : await this.folderOrNull(changes.folder)

    /** Nothing left to remember means no row to keep. */
    if (!title && !folderId) {
      await this.files.delete({ path })

      return { path, title: '', folder_id: null }
    }

    await this.files.save({ path, title, folderId, updatedAt: new Date() })

    return { path, title, folder_id: folderId }
  }

  async remove(url: string): Promise<void> {
    const path = this.storage.keyOf(url)

    await this.storage.remove(url)

    if (path) await this.files.delete({ path })
  }

  /** How many files are not in any folder, for the "all" and "unfiled" tabs. */
  async unfiledCount(): Promise<number> {
    const files = await this.storage.list()

    if (!files.length) return 0

    const filed = await this.files.count({
      where: { path: In(files.map(file => file.path)), folderId: Not(IsNull()) },
    })

    return files.length - filed
  }

  private folderName(name: string): string {
    const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, MAX_FOLDER_NAME)

    if (!trimmed) throw new BadRequestException('A folder needs a name')

    return trimmed
  }

  private async folderOrNull(id: string | null): Promise<string | null> {
    if (!id) return null

    const folder = await this.folders.findOne({ where: { id } })

    if (!folder) throw new NotFoundException('Folder not found')

    return folder.id
  }
}
