import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { StorageService } from '~/shared/storage/storage.service'
import { MediaService } from '~/shared/storage/media.service'
import { MAX_IMAGE_BYTES } from '~/shared/storage/storage.service'
import type { IUploadedFile } from '~/shared/storage/storage.service'
import { AuthGuard } from '~/modules/auth/guards/auth.guard'
import { RolesGuard } from '~/modules/auth/guards/roles.guard'
import { Roles } from '~/modules/auth/decorators'
import { UserRole } from '~/modules/auth/contracts/auth'
import { ContentAdminService } from './content.admin.service'
import { BLOCK_RULES, LIST_KINDS, isListKind, isPage, isSectionKind, isSectionSource } from './content.blocks'
import type { ContentPage, ListKind, SectionKind } from './content.blocks'
import { RevalidationService } from '~/shared/revalidation/revalidation.service'
import type { IBannerInput, IListInput, ISectionInput } from './content.admin.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('cms')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.Agent, UserRole.Manager, UserRole.Admin)
export class ContentAdminController {
  constructor(
    private readonly admin: ContentAdminService,
    private readonly revalidation: RevalidationService,
    private readonly storage: StorageService,
    private readonly media: MediaService,
  ) {}

  @Get('uploads')
  library(@Query('q') q?: string, @Query('folder') folder?: string) {
    return this.media.library(q ?? '', folder ?? '')
  }

  @Get('media/folders')
  folders() {
    return this.media.folderList()
  }

  @Post('media/folders')
  createFolder(@Body() body: { name?: string }) {
    return this.media.createFolder(body.name ?? '')
  }

  @Patch('media/folders/:id')
  renameFolder(@Param('id') id: string, @Body() body: { name?: string }) {
    return this.media.renameFolder(id, body.name ?? '')
  }

  @Delete('media/folders/:id')
  @HttpCode(204)
  removeFolder(@Param('id') id: string): Promise<void> {
    return this.media.removeFolder(id)
  }

  @Post('uploads')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  async upload(@UploadedFile() file?: IUploadedFile) {
    if (!file) throw new BadRequestException('No file was sent')

    return this.storage.upload(file)
  }

  @Delete('uploads')
  @HttpCode(204)
  async removeUpload(@Query('url') url?: string): Promise<void> {
    if (!url) throw new BadRequestException('"url" is required')

    await this.media.remove(url)
  }

  @Patch('uploads')
  async describeUpload(@Body() body: { url?: string, title?: string, folder?: string | null }) {
    if (!body.url) throw new BadRequestException('"url" is required')

    return this.media.describe(body.url, { title: body.title, folder: body.folder })
  }

  @Get('home/banner')
  async banner() {
    return this.admin.banner('home')
  }

  @Put('home/banner')
  async saveBanner(@Body() body: Record<string, unknown>) {
    const saved = await this.admin.saveBanner('home', parseBanner(body))

    await this.revalidation.revalidate()

    return saved
  }

  @Get('layouts')
  async layouts() {
    return {
      items: (await this.admin.layoutsAll()).map(layout => ({
        uuid: layout.id,
        grid: layout.grid,
        name: layout.name,
      })),
    }
  }

  @Post('layouts')
  async createLayout(@Body() body: Record<string, unknown>) {
    const layout = await this.admin.createLayout({
      grid: typeof body?.grid === 'string' ? body.grid : '',
      name: str(body?.name, 'name'),
    })

    return { uuid: layout.id, grid: layout.grid, name: layout.name }
  }

  @Delete('layouts/:id')
  @HttpCode(204)
  async deleteLayout(@Param('id') id: string): Promise<void> {
    await this.admin.removeLayout(id)
  }

  @Get('lists')
  async lists() {
    return { items: await this.admin.listsIndex() }
  }

  @Get('lists/:id')
  async list(@Param('id') id: string) {
    return this.admin.list(id)
  }

  @Post('lists')
  async createList(@Body() body: Record<string, unknown>) {
    const created = await this.admin.createList(parseList(body))

    return created
  }

  @Put('lists/:id')
  async updateList(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    const updated = await this.admin.updateList(id, parseList(body))

    await this.revalidation.revalidate()

    return updated
  }

  @Delete('lists/:id')
  @HttpCode(204)
  async deleteList(@Param('id') id: string): Promise<void> {
    await this.admin.deleteList(id)
    await this.revalidation.revalidate()
  }

  @Get('pages/:page/sections')
  async sections(@Param('page') page: string) {
    return { items: await this.admin.sectionsFor(pageOf(page)) }
  }

  @Put('pages/:page/sections')
  @HttpCode(204)
  async saveSections(@Param('page') page: string, @Body() body: Record<string, unknown>): Promise<void> {
    const items = Array.isArray(body?.items) ? body.items : null

    if (!items) throw new BadRequestException('"items" must be a list of sections')

    await this.admin.replaceSections(pageOf(page), items.map(parseSection))
    await this.revalidation.revalidate()
  }

  @Get('pages/:page/meta')
  async meta(@Param('page') page: string) {
    return this.admin.meta(pageOf(page))
  }

  @Put('pages/:page/meta')
  async saveMeta(@Param('page') page: string, @Body() body: Record<string, unknown>) {
    const seo = body?.seo && typeof body.seo === 'object' ? body.seo as Record<string, { title?: string, description?: string }> : {}
    const saved = await this.admin.saveMeta(pageOf(page), { seo })

    await this.revalidation.revalidate()

    return saved
  }
}

function pageOf(value: string): ContentPage {
  if (!isPage(value)) throw new NotFoundException('No such page')

  return value
}

function str(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`"${field}" is required`)
  }

  return value.trim()
}

function parseList(body: Record<string, unknown>): IListInput {
  const items = Array.isArray(body?.items) ? body.items : []

  return {
    name: str(body?.name, 'name'),
    kind: listKindOf(body?.kind),
    items: items.map((raw) => {
      const item = raw as Record<string, unknown>
      const translations = Array.isArray(item.translations) ? item.translations : []

      return {
        image_url: typeof item.image_url === 'string' ? item.image_url : null,
        link: typeof item.link === 'string' ? item.link : null,
        badge_type: typeof item.badge_type === 'string' ? item.badge_type : null,
        translations: translations.map((t) => {
          const translation = t as Record<string, unknown>

          return {
            locale: str(translation.locale, 'locale'),
            title: typeof translation.title === 'string' ? translation.title : '',
            description: typeof translation.description === 'string' ? translation.description : null,
            badge_label: typeof translation.badge_label === 'string' ? translation.badge_label : null,
          }
        }),
      }
    }),
  }
}

function parseBanner(body: Record<string, unknown>): IBannerInput {
  const translations = Array.isArray(body?.translations) ? body.translations : []

  if (!translations.length) throw new BadRequestException('"translations" is required')

  return {
    translations: translations.map((raw) => {
      const t = raw as Record<string, unknown>

      return {
        locale: str(t.locale, 'locale'),
        title: typeof t.title === 'string' ? t.title : '',
        subtitle: typeof t.subtitle === 'string' ? t.subtitle : null,
        image_url: typeof t.image_url === 'string' ? t.image_url : null,
      }
    }),
  }
}

function kindOf(value: unknown): SectionKind {
  if (value === undefined || value === null) return 'cards'

  if (!isSectionKind(value)) throw new BadRequestException(`"kind" must be one of ${Object.keys(BLOCK_RULES).join(', ')}`)

  return value
}

function listKindOf(value: unknown): ListKind {
  if (value === undefined || value === null) return 'cards'

  if (!isListKind(value)) throw new BadRequestException(`"kind" must be one of ${LIST_KINDS.join(', ')}`)

  return value
}

function parseSection(raw: unknown): ISectionInput {
  const section = raw as Record<string, unknown>
  const translations = Array.isArray(section.translations) ? section.translations : []
  const kind = kindOf(section.kind)
  const source = section.source === undefined ? BLOCK_RULES[kind].sources[0]! : section.source

  if (!isSectionSource(source)) throw new BadRequestException('"source" must be "list" or "posts"')

  return {
    kind,
    source,
    link: typeof section.link === 'string' ? section.link : null,
    anchor: typeof section.anchor === 'string' ? section.anchor : null,
    post_ids: Array.isArray(section.post_ids)
      ? section.post_ids.filter((id): id is string => typeof id === 'string')
      : [],
    list_id: typeof section.list_id === 'string' && section.list_id ? section.list_id : null,
    layout_id: typeof section.layout_id === 'string' && section.layout_id ? section.layout_id : null,
    is_published: section.is_published !== false,
    settings: section.settings,
    translations: translations.map((t) => {
      const translation = t as Record<string, unknown>

      return {
        locale: str(translation.locale, 'locale'),
        title: typeof translation.title === 'string' ? translation.title : '',
        subtitle: typeof translation.subtitle === 'string' ? translation.subtitle : null,
      }
    }),
  }
}
