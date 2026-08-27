import { Injectable, Logger } from '@nestjs/common'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class RevalidationService {
  private readonly logger = new Logger(RevalidationService.name)

  private readonly url = process.env.SITE_REVALIDATE_URL
  private readonly secret = process.env.SITE_REVALIDATE_SECRET

  async revalidate(): Promise<void> {
    if (!this.url || !this.secret) return

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: { 'x-revalidate-secret': this.secret },
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        this.logger.warn(`revalidate returned ${response.status}; pages stay cached until they expire`)
        return
      }

      const body = await response.json() as { cleared?: number }

      this.logger.log(`revalidated: ${body.cleared ?? 0} cached route(s) cleared`)
    }
    catch (error) {
      this.logger.warn(`revalidate failed: ${String(error)}`)
    }
  }
}
