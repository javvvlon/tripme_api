import { BadRequestException, Body, Controller, Get, HttpCode, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { AuthGuard } from '~/modules/auth/guards/auth.guard'
import { RolesGuard } from '~/modules/auth/guards/roles.guard'
import { CurrentUser, Roles } from '~/modules/auth/decorators'
import { UserRole } from '~/modules/auth/contracts/auth'
import type { IAccessTokenClaims } from '~/modules/auth/contracts/auth'
import { viewerOf } from '~/modules/leads/lead.access'
import { MAX_ATTACHMENT_BYTES } from '~/modules/orders/documents/documents.service'
import type { IUploadedFile } from '~/shared/storage/storage.service'
import { FinanceService } from './finance.service'
import type { IPaymentInput } from './finance.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('cms')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.Agent, UserRole.Manager, UserRole.Admin)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('orders/:id/finance')
  overview(@Param('id') id: string, @CurrentUser() claims: IAccessTokenClaims) {
    return this.finance.overview(id, viewerOf(claims))
  }

  @Post('orders/:id/payments')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('receipt', { limits: { fileSize: MAX_ATTACHMENT_BYTES } }))
  record(
    @Param('id') id: string,
    @Body() body: IPaymentInput,
    @CurrentUser() claims: IAccessTokenClaims,
    @UploadedFile() receipt?: IUploadedFile,
  ) {
    return this.finance.record(id, body ?? {}, receipt, viewerOf(claims))
  }

  @Post('payments/:id/reverse')
  @HttpCode(201)
  reverse(@Param('id') id: string, @Body() body: { note?: string }, @CurrentUser() claims: IAccessTokenClaims) {
    return this.finance.reverse(id, body?.note, viewerOf(claims))
  }

  @Patch('orders/:id/deposit')
  deposit(@Param('id') id: string, @Body() body: { percent?: number | null }, @CurrentUser() claims: IAccessTokenClaims) {
    if (!body || !('percent' in body)) throw new BadRequestException('percent is required')

    return this.finance.setDeposit(id, body.percent, viewerOf(claims))
  }

  @Patch('orders/:id/items/:itemId/rate')
  rate(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: { fx_rate?: number },
    @CurrentUser() claims: IAccessTokenClaims,
  ) {
    return this.finance.setItemRate(id, itemId, body?.fx_rate, viewerOf(claims))
  }
}
