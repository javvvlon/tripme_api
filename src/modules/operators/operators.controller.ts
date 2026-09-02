import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common'
import { AuthGuard } from '~/modules/auth/guards/auth.guard'
import { RolesGuard } from '~/modules/auth/guards/roles.guard'
import { Roles } from '~/modules/auth/decorators'
import { UserRole } from '~/modules/auth/contracts/auth'
import { OPERATOR_CONNECTIONS } from './operator.entity'
import { OperatorsService } from './operators.service'
import type { IOperatorPatch } from './operators.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('cms/operators')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.Manager, UserRole.Admin)
export class OperatorsController {
  constructor(private readonly operators: OperatorsService) {}

  @Get()
  async list() {
    return { items: await this.operators.list(), connections: OPERATOR_CONNECTIONS }
  }

  @Patch(':id')
  patch(@Param('id') id: string, @Body() body: IOperatorPatch) {
    return this.operators.patch(id, body)
  }
}
