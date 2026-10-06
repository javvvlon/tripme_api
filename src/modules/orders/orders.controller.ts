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
import { viewerOf } from '~/modules/leads/lead.access'

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
  async documentsFor(@Param('id') id: string, @CurrentUser() claims: IAccessTokenClaims) {
    await this.orders.assertVisible(id, viewerOf(claims))

    return this.documents.list(id)
  }

  @Post('orders/:id/documents/:kind')
  @HttpCode(201)
  async generate(
    @Param('id') id: string,
    @Param('kind') kind: string,
    @CurrentUser() claims: IAccessTokenClaims,
  ) {
    if (!GENERATED_KINDS.includes(kind as never)) {
      throw new BadRequestException('A document is either an offer or an invoice')
    }

    await this.orders.assertVisible(id, viewerOf(claims))

    return this.documents.generate(id, kind as DocumentFlavour, claims?.sub ?? null)
  }

  @Post('orders/:id/attachments')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES } }))
  async attach(
    @Param('id') id: string,
    @CurrentUser() claims: IAccessTokenClaims,
    @UploadedFile() file?: IUploadedFile,
  ) {
    if (!file) throw new BadRequestException('No file was sent')

    await this.orders.assertVisible(id, viewerOf(claims))

    return this.documents.attach(id, file, claims?.sub ?? null)
  }

  @Delete('documents/:id')
  @HttpCode(204)
  async removeDocument(@Param('id') id: string, @CurrentUser() claims: IAccessTokenClaims): Promise<void> {
    await this.orders.assertVisible(await this.documents.orderIdOf(id), viewerOf(claims))
    await this.documents.remove(id)
  }

  @Get('orders')
  list(
    @CurrentUser() claims: IAccessTokenClaims,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('manager') manager?: string,
  ) {
    return this.orders.list({ q, status, manager }, viewerOf(claims))
  }

  @Get('orders/statuses')
  statuses() {
    return { items: ORDER_STATUSES, transitions: ORDER_TRANSITIONS }
  }

  @Get('leads/:id/orders')
  forLead(@Param('id') id: string, @CurrentUser() claims: IAccessTokenClaims) {
    return this.orders.forLead(id, viewerOf(claims))
  }

  @Post('leads/:id/orders')
  @HttpCode(201)
  create(
    @Param('id') id: string,
    @Body() body: IOrderCreateInput,
    @CurrentUser() claims: IAccessTokenClaims,
  ) {
    return this.orders.create(id, body, viewerOf(claims))
  }

  @Get('orders/:id')
  one(@Param('id') id: string, @CurrentUser() claims: IAccessTokenClaims) {
    return this.orders.one(id, viewerOf(claims))
  }

  @Get('orders/:id/history')
  history(@Param('id') id: string, @CurrentUser() claims: IAccessTokenClaims) {
    return this.orders.history(id, viewerOf(claims))
  }

  @Patch('orders/:id')
  patch(
    @Param('id') id: string,
    @Body() body: IOrderPatchInput,
    @CurrentUser() claims: IAccessTokenClaims,
  ) {
    return this.orders.patch(id, body, viewerOf(claims))
  }

  @Delete('orders/:id')
  remove(@Param('id') id: string, @CurrentUser() claims: IAccessTokenClaims) {
    return this.orders.remove(id, viewerOf(claims))
  }
}
