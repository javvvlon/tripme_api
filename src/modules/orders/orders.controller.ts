import {
  BadRequestException,
  Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { AuthGuard } from '~/modules/auth/guards/auth.guard'
import { RolesGuard } from '~/modules/auth/guards/roles.guard'
import { CurrentUser, Roles } from '~/modules/auth/decorators'
import { UserRole } from '~/modules/auth/contracts/auth'
import type { IAccessTokenClaims } from '~/modules/auth/contracts/auth'
import { ORDER_STATUSES, ORDER_TRANSITIONS } from './order.entity'
import { OrdersService } from './orders.service'
import { DocumentsService, MAX_ATTACHMENT_BYTES } from './documents/documents.service'
import { GENERATED_KINDS } from './order-document.entity'
import type { IUploadedFile } from '~/shared/storage/storage.service'
import type { DocumentFlavour } from './documents/pdf.builder'
import type { IOrderCreateInput, IOrderPatchInput } from './orders.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('cms')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.Agent, UserRole.Manager, UserRole.Admin)
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly documents: DocumentsService,
  ) {}

  @Get('orders/:id/documents')
  documentsFor(@Param('id') id: string) {
    return this.documents.list(id)
  }

  /**
   * Writes the commercial offer or the invoice for this order. Which one is
   * a path segment rather than a body field so the two cannot be confused by
   * a stray payload.
   */
  @Post('orders/:id/documents/:kind')
  @HttpCode(201)
  generate(
    @Param('id') id: string,
    @Param('kind') kind: string,
    @CurrentUser() claims: IAccessTokenClaims,
  ) {
    if (!GENERATED_KINDS.includes(kind as never)) {
      throw new BadRequestException('A document is either an offer or an invoice')
    }

    return this.documents.generate(id, kind as DocumentFlavour, claims?.sub ?? null)
  }

  @Post('orders/:id/attachments')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES } }))
  attach(
    @Param('id') id: string,
    @CurrentUser() claims: IAccessTokenClaims,
    @UploadedFile() file?: IUploadedFile,
  ) {
    if (!file) throw new BadRequestException('No file was sent')

    return this.documents.attach(id, file, claims?.sub ?? null)
  }

  @Delete('documents/:id')
  @HttpCode(204)
  removeDocument(@Param('id') id: string): Promise<void> {
    return this.documents.remove(id)
  }

  @Get('orders')
  list(@Query('q') q?: string, @Query('status') status?: string) {
    return this.orders.list({ q, status })
  }

  @Get('orders/statuses')
  statuses() {
    return { items: ORDER_STATUSES, transitions: ORDER_TRANSITIONS }
  }

  @Get('leads/:id/orders')
  forLead(@Param('id') id: string) {
    return this.orders.forLead(id)
  }

  @Post('leads/:id/orders')
  @HttpCode(201)
  create(
    @Param('id') id: string,
    @Body() body: IOrderCreateInput,
    @CurrentUser() claims: IAccessTokenClaims,
  ) {
    return this.orders.create(id, body, claims?.sub ?? null)
  }

  @Get('orders/:id')
  one(@Param('id') id: string) {
    return this.orders.one(id)
  }

  @Get('orders/:id/history')
  history(@Param('id') id: string) {
    return this.orders.history(id)
  }

  @Patch('orders/:id')
  patch(
    @Param('id') id: string,
    @Body() body: IOrderPatchInput,
    @CurrentUser() claims: IAccessTokenClaims,
  ) {
    return this.orders.patch(id, body, claims?.sub ?? null)
  }

  @Delete('orders/:id')
  remove(@Param('id') id: string) {
    return this.orders.remove(id)
  }
}
