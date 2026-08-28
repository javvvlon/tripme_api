import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({ controllers: [HealthController] })
export class HealthModule {}
