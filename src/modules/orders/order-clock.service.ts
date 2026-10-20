import { Injectable, Logger } from '@nestjs/common'
import type { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common'
import { OrdersService } from './orders.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const CLOCK_MINUTES = 15

@Injectable()
export class OrderClockService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OrderClockService.name)

  private timer: NodeJS.Timeout | null = null

  private running = false

  constructor(private readonly orders: OrdersService) {}

  onApplicationBootstrap(): void {
    if (process.env.ORDER_CLOCK === 'off' || process.env.NODE_ENV === 'test') return

    this.timer = setInterval(() => void this.tick(), CLOCK_MINUTES * 60 * 1000)
    this.timer.unref()

    void this.tick()
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
  }

  private async tick(): Promise<void> {
    if (this.running) return

    this.running = true

    try {
      const moved = await this.orders.tickClock()

      if (moved) this.logger.log(`moved ${moved} order(s) by trip dates`)
    }
    catch (error) {
      this.logger.warn(`order clock failed: ${String(error)}`)
    }
    finally {
      this.running = false
    }
  }
}
