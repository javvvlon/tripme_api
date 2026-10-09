import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { MAX_ATTACHMENT_BYTES } from '~/modules/orders/documents/documents.service'
import type { IUploadedFile } from '~/shared/storage/storage.service'
import { AuthGuard } from '~/modules/auth/guards/auth.guard'
import { RolesGuard } from '~/modules/auth/guards/roles.guard'
import { CurrentUser, Roles } from '~/modules/auth/decorators'
import { UserRole } from '~/modules/auth/contracts/auth'
import { OrdersService } from '~/modules/orders/orders.service'
import { viewerOf } from '~/modules/leads/lead.access'
import { AccountService } from './account.service'
import type { IAccessTokenClaims } from '~/modules/auth/contracts/auth'
import type { ITravellerInput } from './traveller.rules'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('account')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.Client)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('orders')
  orders(@CurrentUser() claims: IAccessTokenClaims) {
    return this.account.list(claims.sub)
  }

  @Get('orders/:id')
  order(@CurrentUser() claims: IAccessTokenClaims, @Param('id') id: string) {
    return this.account.one(claims.sub, id)
  }

  @Post('orders/:id/documents')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES } }))
  upload(@CurrentUser() claims: IAccessTokenClaims, @Param('id') id: string, @UploadedFile() file?: IUploadedFile) {
    if (!file) throw new BadRequestException('No file was sent')

    return this.account.uploadDocument(claims.sub, id, file)
  }

  @Delete('documents/:id')
  @HttpCode(204)
  async removeDocument(@CurrentUser() claims: IAccessTokenClaims, @Param('id') id: string): Promise<void> {
    await this.account.removeDocument(claims.sub, id)
  }

  @Get('requests')
  requests(@CurrentUser() claims: IAccessTokenClaims) {
    return this.account.requests(claims.sub)
  }

  @Get('esim')
  esim(@CurrentUser() claims: IAccessTokenClaims) {
    return this.account.esimPurchases(claims.sub)
  }

  @Get('travellers')
  travellers(@CurrentUser() claims: IAccessTokenClaims) {
    return this.account.travellersOf(claims.sub)
  }

  @Post('travellers')
  @HttpCode(201)
  addTraveller(@CurrentUser() claims: IAccessTokenClaims, @Body() body: ITravellerInput) {
    return this.account.addTraveller(claims.sub, body ?? {})
  }

  @Patch('travellers/:id')
  updateTraveller(@CurrentUser() claims: IAccessTokenClaims, @Param('id') id: string, @Body() body: ITravellerInput) {
    return this.account.updateTraveller(claims.sub, id, body ?? {})
  }

  @Delete('travellers/:id')
  @HttpCode(204)
  async removeTraveller(@CurrentUser() claims: IAccessTokenClaims, @Param('id') id: string): Promise<void> {
    await this.account.removeTraveller(claims.sub, id)
  }
}

@Controller('cms/orders')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.Agent, UserRole.Manager, UserRole.Admin)
export class CustomerTravellersController {
  constructor(
    private readonly account: AccountService,
    private readonly orders: OrdersService,
  ) {}

  @Get(':id/travellers')
  async travellers(@Param('id') id: string, @CurrentUser() claims: IAccessTokenClaims) {
    const order = await this.orders.one(id, viewerOf(claims))

    return this.account.travellersForLead(order.lead_id)
  }
}
