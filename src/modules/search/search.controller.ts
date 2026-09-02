import { Controller, Get, Query } from '@nestjs/common'
import { SearchService } from './search.service'
import { SoonestCache } from './soonest.cache'
import { toCriteria, toSoonestCriteria } from './search.query'
import { buildFacets } from './facets'
import type { SearchQueryDto } from './search.query'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('search')
export class SearchController {
  constructor(
    private readonly search: SearchService,
    private readonly soonestCache: SoonestCache,
  ) {}

  /**
   * The first day this route is actually being sold on, so a visitor who
   * arrived without a date is shown tours rather than an empty page.
   */
  @Get('soonest')
  async soonest(@Query() query: SearchQueryDto): Promise<unknown> {
    const today = new Date().toISOString().slice(0, 10)
    const criteria = toSoonestCriteria(query, today)

    return this.soonestCache.through(criteria, () => this.search.soonest(criteria))
  }

  @Get('offers')
  async offers(@Query() query: SearchQueryDto, @Query('page') page?: string): Promise<unknown> {
    const criteria = toCriteria(query)
    const pageNumber = Math.max(1, Math.min(Number(page) || 1, 20))

    const result = await this.search.fetchPage(criteria, pageNumber)

    return {
      criteria,
      page: result.page,
      hasMore: result.hasMore,
      appliedLocally: result.appliedLocally,
      statuses: result.statuses,
      total: result.offers.length,
      items: result.offers.map(o => o.toObject()),
      facets: buildFacets(result.offers, 100),
    }
  }
}
