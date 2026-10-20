import { Module } from '@nestjs/common'
import { SuppliersModule } from '~/modules/suppliers/suppliers.module'
import { OperatorsModule } from '~/modules/operators/operators.module'
import { ReferencesModule } from '~/modules/references/references.module'
import { SearchController } from './search.controller'
import { SearchService } from './search.service'
import { SoonestCache } from './soonest.cache'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [SuppliersModule, OperatorsModule, ReferencesModule],
  controllers: [SearchController],
  providers: [SearchService, SoonestCache],
  exports: [SearchService],
})
export class SearchModule {}
