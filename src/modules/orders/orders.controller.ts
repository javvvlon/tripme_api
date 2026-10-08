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
import { DocumentKind, GENERATED_KINDS } from './order-document.entity'
import type { IUploadedFile } from '~/shared/storage/storage.service'
import type { DocumentFlavour } from './documents/pdf.builder'
import type { IOrderCreateInput, IOrderPatchInput } from './orders.service'
import type { IOrderItemInput } from './items/item-rules'
import { viewerOf } from '~/modules/leads/lead.access'
import { pageRequest } from '~/shared/helpers/pagination'

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

    return this.documents.generate(id, kind as DocumentFlavour, claims?.sub ?? null, await this.orders.documentMoney(id))
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

  @Post('orders/:id/contract')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES } }))
  async contract(
    @Param('id') id: string,
    @CurrentUser() claims: IAccessTokenClaims,
    @UploadedFile() file?: IUploadedFile,
  ) {
    if (!file) throw new BadRequestException('No file was sent')

    const viewer = viewerOf(claims)

    await this.orders.assertVisible(id, viewer)

    const document = await this.documents.attach(id, file, claims?.sub ?? null, DocumentKind.Contract)

    await this.orders.markContract(id, document.id)
    await this.orders.advance(id, viewer.id)

    return this.orders.one(id, viewer)
  }

  @Post('orders/:id/items/:itemId/confirm')
  @HttpCode(201)
  confirmItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: { supplier_ref?: string },
    @CurrentUser() claims: IAccessTokenClaims,
  ) {
    return this.orders.confirmItem(id, itemId, body?.supplier_ref, viewerOf(claims))
  }

  @Post('orders/:id/items')
  @HttpCode(201)
  addItem(@Param('id') id: string, @Body() body: IOrderItemInput, @CurrentUser() claims: IAccessTokenClaims) {
    return this.orders.addItem(id, body, viewerOf(claims))
  }

  @Patch('orders/:id/items/:itemId')
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: IOrderItemInput,
    @CurrentUser() claims: IAccessTokenClaims,
  ) {
    return this.orders.updateItem(id, itemId, body, viewerOf(claims))
  }

  @Delete('orders/:id/items/:itemId')
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string, @CurrentUser() claims: IAccessTokenClaims) {
    return this.orders.removeItem(id, itemId, viewerOf(claims))
  }

  @Post('orders/:id/items/:itemId/issue')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES } }))
  async issueItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() claims: IAccessTokenClaims,
    @UploadedFile() file?: IUploadedFile,
  ) {
    const viewer = viewerOf(claims)

    await this.orders.assertItemIssuable(id, itemId, viewer)

    const document = file ? await this.documents.attach(id, file, claims?.sub ?? null, DocumentKind.Voucher) : null

    return this.orders.issueItem(id, itemId, document?.id ?? null, viewer)
  }

  @Delete('documents/:id')
  @HttpCode(204)
  async removeDocument(@Param('id') id: string, @CurrentUser() claims: IAccessTokenClaims): Promise<void> {
    await this.orders.assertVisible(await this.documents.orderIdOf(id), viewerOf(claims))
    await this.orders.assertDocumentRemovable(id)
    await this.documents.remove(id)
    await this.orders.documentRemoved(id)
  }

  @Get('orders')
  list(
    @CurrentUser() claims: IAccessTokenClaims,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('manager') manager?: string,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
  ) {
    const query = { q, status, manager }
    const viewer = viewerOf(claims)
    const request = pageRequest(page, perPage)

    return request ? this.orders.page(query, request, viewer) : this.orders.list(query, viewer)
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
