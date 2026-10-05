import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '~/modules/auth/guards/auth.guard'
import { RolesGuard } from '~/modules/auth/guards/roles.guard'
import { CurrentUser, Roles } from '~/modules/auth/decorators'
import { UserRole } from '~/modules/auth/contracts/auth'
import { AnalyticsService } from './analytics.service'
import type { IAccessTokenClaims } from '~/modules/auth/contracts/auth'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_DAYS = 366
const DEFAULT_DAYS = 30
const SEES_EVERYONE = [UserRole.Manager, UserRole.Admin]

const tashkentToday = (): string => new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10)

const shift = (day: string, days: number): string => {
  const at = new Date(`${day}T00:00:00Z`)

  at.setUTCDate(at.getUTCDate() + days)

  return at.toISOString().slice(0, 10)
}

@Controller('cms/analytics')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.Agent, UserRole.Freelancer, UserRole.Manager, UserRole.Admin)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  report(@Query('from') from: string | undefined, @Query('to') to: string | undefined, @CurrentUser() claims: IAccessTokenClaims) {
    const end = to && ISO_DATE.test(to) ? to : tashkentToday()
    const start = from && ISO_DATE.test(from) ? from : shift(end, -(DEFAULT_DAYS - 1))

    if (start > end) throw new BadRequestException('The period starts after it ends')

    const days = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1

    if (days > MAX_DAYS) throw new BadRequestException(`The period can be at most ${MAX_DAYS} days`)

    return this.analytics.report({
      from: start,
      to: end,
      managerId: SEES_EVERYONE.includes(claims.role) ? null : claims.sub,
    })
  }
}
