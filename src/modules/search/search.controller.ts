import { Controller, Get, Query } from '@nestjs/common'
import { SearchService } from './search.service'
import { toCriteria } from './search.query'
import { buildFacets } from './facets'
import type { SearchQueryDto } from './search.query'

/**
 * `GET /search/offers` — one page of results.
 *
 * Deliberately not a stream. Streaming solved a problem this design does not
 * have: the 27 seconds came from walking ten pages sequentially, not from
 * suppliers being slow. Asking every supplier for page 1 in parallel answers
 * in about two seconds, and the agent's scroll decides whether page 2 is ever
 * requested at all — so a supplier only receives requests a person caused.
 *
 * It also keeps the endpoint cacheable, renderable during SSR, and free of the
 * proxy-buffering and connection-lifetime problems SSE brings with it.
 *
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
      statuses: result.statuses,
      total: result.offers.length,
      items: result.offers.map(o => o.toObject()),
      // Counts describe the offers on this page, not the market — a page is
      // the cheapest hundred, and `partial` says so.
      facets: buildFacets(result.offers, 100),
    }
  }
}
