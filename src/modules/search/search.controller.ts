import { randomUUID } from 'node:crypto'
import { Controller, Get, Query, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { SearchService } from './search.service'
import { toCriteria } from './search.query'
import { buildFacets } from './facets'
import type { SearchQueryDto } from './search.query'
import type { Offer } from './models/Offer'

/**
 * `GET /search` — one search, streamed.
 *
 * Server-Sent Events rather than a plain response, because the product
 * requirement is explicitly incremental: first offers within a few seconds, a
 * visible row of who has answered, and no waiting for the slowest supplier
 * (§4). A JSON response could only be sent once everyone finished, which is
 * the behaviour the whole project exists to remove.
 *
 * SSE over WebSockets: the stream is one-directional and short-lived, and it
 * survives proxies without an upgrade handshake.
 *
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  /**
   * The same search, collected into one JSON response.
   *
   * SSE cannot run during server-side rendering, and a crawler will not hold a
   * stream open — so the page's first render uses this, and the browser then
   * opens the stream for the waves. Slower by definition: it waits for the
   * last supplier.
   */
  @Get('offers')
  async collect(@Query() query: SearchQueryDto, @Query('pages') pages?: string): Promise<unknown> {
    const criteria = toCriteria(query)

    // One page by default. A supplier's first page is its cheapest hundred
    // rows and arrives in ~2s; exhausting the listing takes ~27s because of
    // the deliberate interval between requests. Anything that needs the whole
    // set should be reading the stream, not blocking on this.
    const maxPages = Math.max(1, Math.min(Number(pages) || 1, 20))
    const collected: Offer[] = []
    const offers: unknown[] = []
    let statuses: unknown[] = []

    for await (const update of this.search.search(criteria, undefined, maxPages)) {
      collected.push(...update.offers)
      offers.push(...update.offers.map(o => o.toObject()))
      statuses = update.statuses
    }

    return {
      criteria,
      statuses,
      total: offers.length,
      items: offers,
      // Derived from what came back, and flagged as partial when the page was
      // full — the client must not present these as market-wide totals.
      facets: buildFacets(collected, 100),
    }
  }

  @Get()
  async stream(
    @Query() query: SearchQueryDto,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const criteria = toCriteria(query)
    const searchId = randomUUID()

    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      // nginx buffers SSE by default, which turns waves back into one lump.
      'X-Accel-Buffering': 'no',
    })

    // The client going away must stop the suppliers, not leave them running.
    const controller = new AbortController()
    request.on('close', () => controller.abort())

    const send = (event: string, data: unknown) => {
      response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    send('open', { searchId, criteria })

    try {
      for await (const update of this.search.search(criteria, controller.signal)) {
        if (controller.signal.aborted) break

        if (update.offers.length) {
          send('offers', { searchId, offers: update.offers.map(o => o.toObject()) })
        }

        send('status', { searchId, statuses: update.statuses })

        if (update.done) send('done', { searchId, statuses: update.statuses })
      }
    }
    catch (error) {
      send('error', { searchId, message: error instanceof Error ? error.message : 'search failed' })
    }
    finally {
      response.end()
    }
  }
}
