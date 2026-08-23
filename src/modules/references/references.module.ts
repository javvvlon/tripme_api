import { Module } from '@nestjs/common'
import { SuppliersModule } from '~/modules/suppliers/suppliers.module'
import { ReferencesController } from './references.controller'
import { CalendarService } from './calendar.service'
import { RouteLookupService } from './route-lookup.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [SuppliersModule],
  controllers: [ReferencesController],
  providers: [CalendarService, RouteLookupService],
})
export class ReferencesModule {}
