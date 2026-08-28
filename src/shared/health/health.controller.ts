import { Controller, Get } from '@nestjs/common'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; uptime: number } {
    return { status: 'ok', uptime: Math.round(process.uptime()) }
  }
}
