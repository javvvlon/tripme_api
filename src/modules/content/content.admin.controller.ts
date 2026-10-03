import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { BadRequestException } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { StorageService } from '~/shared/storage/storage.service'
import { MediaService } from '~/shared/storage/media.service'
import { MAX_IMAGE_BYTES } from '~/shared/storage/storage.service'
import type { IUploadedFile } from '~/shared/storage/storage.service'
import { AuthGuard } from '~/modules/auth/guards/auth.guard'
import { RolesGuard } from '~/modules/auth/guards/roles.guard'
import { Roles } from '~/modules/auth/decorators'
import { UserRole } from '~/modules/auth/contracts/auth'
import { SECTION_VARIANTS, ContentAdminService } from './content.admin.service'
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

  @Get('sections')
  async sections() {
    return { items: await this.admin.sectionsFor('home') }
  }

  @Put('sections')
  @HttpCode(204)
  async saveSections(@Body() body: Record<string, unknown>): Promise<void> {
    const items = Array.isArray(body?.items) ? body.items : null

    if (!items) throw new BadRequestException('"items" must be a list of sections')

    await this.admin.replaceSections('home', items.map(parseSection))
    await this.revalidation.revalidate()
  }
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

function parseSection(raw: unknown): ISectionInput {
  const section = raw as Record<string, unknown>
  const translations = Array.isArray(section.translations) ? section.translations : []
  const asked = typeof section.variant === 'string' ? section.variant : 'list'
  const variant = SECTION_VARIANTS.includes(asked) ? asked : 'list'

  return {
    link: typeof section.link === 'string' ? section.link : null,
    variant,
    post_ids: Array.isArray(section.post_ids)
      ? section.post_ids.filter((id): id is string => typeof id === 'string')
      : [],
    list_id: variant === 'posts'
      ? (typeof section.list_id === 'string' ? section.list_id : null)
      : str(section.list_id, 'list_id'),
    layout_id: str(section.layout_id, 'layout_id'),
    is_published: section.is_published !== false,
    translations: translations.map((t) => {
      const translation = t as Record<string, unknown>

      return {
        locale: str(translation.locale, 'locale'),
        title: typeof translation.title === 'string' ? translation.title : '',
      }
    }),
  }
}
