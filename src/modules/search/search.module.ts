import { Module } from '@nestjs/common'
import { SuppliersModule } from '~/modules/suppliers/suppliers.module'
import { OperatorsModule } from '~/modules/operators/operators.module'
import { SearchController } from './search.controller'
import { SearchService } from './search.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [SuppliersModule, OperatorsModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
