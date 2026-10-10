import { Controller, Get, Query, Sse } from '@nestjs/common'
import { map } from 'rxjs'
import type { MessageEvent } from '@nestjs/common'
import type { Observable } from 'rxjs'
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

  @Get('soonest')
  async soonest(@Query() query: SearchQueryDto): Promise<unknown> {
    const today = new Date().toISOString().slice(0, 10)
    const criteria = toSoonestCriteria(query, today)

    return this.soonestCache.through(criteria, () => this.search.soonest(criteria))
  }

  @Get('hotels')
  hotels(@Query('from') from = '', @Query('to') to = '', @Query('q') q = ''): Promise<unknown> {
    return this.search.hotels(String(from), String(to), String(q).slice(0, 80))
  }

  @Sse('offers/stream')
  stream(@Query() query: SearchQueryDto): Observable<MessageEvent> {
    const criteria = toCriteria(query)

    return this.search.stream(criteria).pipe(map(event => ({ data: event })))
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
