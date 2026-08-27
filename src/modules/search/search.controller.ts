import { Controller, Get, Query } from '@nestjs/common'
import { SearchService } from './search.service'
import { toCriteria } from './search.query'
import { buildFacets } from './facets'
import type { SearchQueryDto } from './search.query'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

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
