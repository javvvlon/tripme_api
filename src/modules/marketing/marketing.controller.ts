import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Put, Query, UnauthorizedException, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express'
import { AuthGuard } from '~/modules/auth/guards/auth.guard'
import { RolesGuard } from '~/modules/auth/guards/roles.guard'
import { CurrentUser, Roles } from '~/modules/auth/decorators'
import { UserRole } from '~/modules/auth/contracts/auth'
import type { IAccessTokenClaims } from '~/modules/auth/contracts/auth'
import { DEFAULT_PER_PAGE, pageRequest } from '~/shared/helpers/pagination'
import { MAX_IMAGE_BYTES } from '~/shared/storage/storage.service'
import type { IUploadedFile } from '~/shared/storage/storage.service'
import { MarketingService } from './marketing.service'
import { BotIntakeService } from './intake/bot.service'
import type { ITelegramUpdate } from './intake/bot'
import type { IPublishInput } from './marketing.service'
import { MAX_VIDEO_BYTES } from './telegram.publisher'
import type { IPublishFiles } from './telegram.publisher'

const imageOf = (file: IUploadedFile | undefined) =>
  file?.buffer?.length && /^image\/(png|jpe?g|webp)$/.test(file.mimetype) ? { mimeType: file.mimetype, data: file.buffer } : null

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('marketing')
export class MarketingController {
  constructor(private readonly marketing: MarketingService) {}

  @Get('p/:code')
  selection(@Param('code') code: string) {
    return this.marketing.publicView(code)
  }
}

@Controller('cms/marketing/selections')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.Agent, UserRole.Manager, UserRole.Admin)
export class MarketingCmsController {
  constructor(private readonly marketing: MarketingService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('archived') archived?: string,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
  ) {
    return this.marketing.page({ q, archived }, pageRequest(page ?? 1, perPage ?? DEFAULT_PER_PAGE)!)
  }

  @Post()
  @HttpCode(201)
  create(@Body() body: { title?: unknown, tours?: unknown }, @CurrentUser() claims: IAccessTokenClaims) {
    return this.marketing.create(body, claims.sub)
  }

  @Post('assistant')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  assistant(
    @Body() body: { text?: unknown, history?: unknown },
    @UploadedFile() file: IUploadedFile | undefined,
    @CurrentUser() claims: IAccessTokenClaims,
  ) {
    return this.marketing.assist({ text: typeof body?.text === 'string' ? body.text : '', image: imageOf(file), history: body?.history }, claims.sub)
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.marketing.one(id)
  }

  @Patch(':id')
  patch(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.marketing.patch(id, body ?? {})
  }

  @Post(':id/recheck')
  @HttpCode(200)
  recheck(@Param('id') id: string) {
    return this.marketing.recheck(id)
  }

  @Post(':id/copy')
  @HttpCode(200)
  write(@Param('id') id: string, @Body() body: { languages?: unknown }) {
    return this.marketing.write(id, body ?? {})
  }

  @Post(':id/templates')
  @HttpCode(200)
  designTemplates(@Param('id') id: string) {
    return this.marketing.designTemplates(id)
  }

  @Post(':id/background')
  @HttpCode(200)
  paint(@Param('id') id: string) {
    return this.marketing.paint(id)
  }

  @Patch(':id/background')
  useBackground(@Param('id') id: string, @Body() body: { url?: unknown }) {
    return this.marketing.useBackground(id, body ?? {})
  }

  @Post(':id/publish')
  @HttpCode(200)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }], { limits: { fileSize: MAX_VIDEO_BYTES, files: 1 } }))
  publish(
    @Param('id') id: string,
    @UploadedFiles() files: IPublishFiles | undefined,
    @Body() body: IPublishInput,
    @CurrentUser() claims: IAccessTokenClaims,
  ) {
    return this.marketing.publish(id, files ?? {}, body ?? {}, claims.sub)
  }

  @Post(':id/archive')
  @HttpCode(200)
  archive(@Param('id') id: string, @CurrentUser() claims: IAccessTokenClaims) {
    return this.marketing.setArchived(id, claims.sub, true)
  }

  @Post(':id/restore')
  @HttpCode(200)
  restore(@Param('id') id: string, @CurrentUser() claims: IAccessTokenClaims) {
    return this.marketing.setArchived(id, claims.sub, false)
  }
}

@Controller('cms/marketing/settings')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.Agent, UserRole.Manager, UserRole.Admin)
export class MarketingSettingsController {
  constructor(private readonly marketing: MarketingService) {}

  @Get()
  read() {
    return this.marketing.settings()
  }

  @Put()
  @Roles(UserRole.Manager, UserRole.Admin)
  save(@Body() body: { voice?: unknown, contacts?: unknown, footer?: unknown, visual?: unknown }, @CurrentUser() claims: IAccessTokenClaims) {
    return this.marketing.saveSettings(body ?? {}, claims.sub)
  }
}

@Controller('cms/marketing/templates')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.Agent, UserRole.Manager, UserRole.Admin)
export class MarketingTemplatesController {
  constructor(private readonly marketing: MarketingService) {}

  @Get()
  list() {
    return this.marketing.savedTemplates()
  }

  @Post()
  @HttpCode(201)
  save(@Body() body: { name?: unknown, spec?: unknown }, @CurrentUser() claims: IAccessTokenClaims) {
    return this.marketing.saveTemplate(body ?? {}, claims.sub)
  }

  @Post(':id/archive')
  @HttpCode(200)
  archive(@Param('id') id: string, @CurrentUser() claims: IAccessTokenClaims) {
    return this.marketing.archiveTemplate(id, claims.sub)
  }
}

@Controller('marketing/telegram')
export class MarketingTelegramController {
  constructor(private readonly bot: BotIntakeService) {}

  @Post('webhook')
  @HttpCode(200)
  webhook(@Headers('x-telegram-bot-api-secret-token') secret: string | undefined, @Body() update: ITelegramUpdate) {
    if (!this.bot.trusted(secret)) throw new UnauthorizedException()

    if (update && typeof update.update_id === 'number') void this.bot.handle(update)

    return { ok: true }
  }
}

@Controller('cms/marketing/bot')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.Agent, UserRole.Manager, UserRole.Admin)
export class MarketingBotController {
  constructor(private readonly bot: BotIntakeService) {}

  @Get()
  status(@CurrentUser() claims: IAccessTokenClaims) {
    return this.bot.status(claims.sub)
  }

  @Post('link')
  @HttpCode(200)
  link(@CurrentUser() claims: IAccessTokenClaims) {
    return this.bot.link(claims.sub)
  }

  @Post('unlink')
  @HttpCode(200)
  unlink(@CurrentUser() claims: IAccessTokenClaims) {
    return this.bot.unlink(claims.sub)
  }
}
