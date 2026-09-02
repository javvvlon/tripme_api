import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '~/modules/auth/guards/auth.guard'
import { RolesGuard } from '~/modules/auth/guards/roles.guard'
import { CurrentUser, Roles } from '~/modules/auth/decorators'
import { UserRole } from '~/modules/auth/contracts/auth'
import type { IAccessTokenClaims } from '~/modules/auth/contracts/auth'
import { ORDER_STATUSES, ORDER_TRANSITIONS } from './order.entity'
import { OrdersService } from './orders.service'
import type { IOrderCreateInput, IOrderPatchInput } from './orders.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('cms')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.Agent, UserRole.Manager, UserRole.Admin)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

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
