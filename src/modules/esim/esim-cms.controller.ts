import { Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '~/modules/auth/guards/auth.guard'
import { RolesGuard } from '~/modules/auth/guards/roles.guard'
import { Roles } from '~/modules/auth/decorators'
import { UserRole } from '~/modules/auth/contracts/auth'
import { DEFAULT_PER_PAGE, pageRequest } from '~/shared/helpers/pagination'
import { EsimService } from './esim.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('cms/esim')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.Manager, UserRole.Admin)
export class EsimCmsController {
  constructor(private readonly esim: EsimService) {}

  @Get('purchases')
  list(
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    return this.esim.page(pageRequest(page ?? 1, perPage) ?? { page: 1, perPage: DEFAULT_PER_PAGE, skip: 0 }, status, q)
  }

  @Post('purchases/:id/retry')
  @HttpCode(200)
  retry(@Param('id') id: string) {
    return this.esim.retry(id)
  }
}
