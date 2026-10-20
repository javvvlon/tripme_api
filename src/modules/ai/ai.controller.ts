import { Body, Controller, HttpCode, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { AuthGuard } from '~/modules/auth/guards/auth.guard'
import { RolesGuard } from '~/modules/auth/guards/roles.guard'
import { CurrentUser, Roles } from '~/modules/auth/decorators'
import { UserRole } from '~/modules/auth/contracts/auth'
import type { IAccessTokenClaims } from '~/modules/auth/contracts/auth'
import { MAX_IMAGE_BYTES } from '~/shared/storage/storage.service'
import type { IUploadedFile } from '~/shared/storage/storage.service'
import { AiService } from './ai.service'

const imageOf = (file: IUploadedFile | undefined) =>
  file?.buffer?.length && /^image\/(png|jpe?g|webp)$/.test(file.mimetype) ? { mimeType: file.mimetype, data: file.buffer } : null

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('cms/ai')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.Agent, UserRole.Manager, UserRole.Admin)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post()
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  ask(
    @Body() body: { text?: unknown, history?: unknown, context?: unknown },
    @UploadedFile() file: IUploadedFile | undefined,
    @CurrentUser() claims: IAccessTokenClaims,
  ) {
    return this.ai.ask({ text: body?.text, history: body?.history, context: body?.context, image: imageOf(file) }, claims.sub)
  }
}
