import { Module } from '@nestjs/common'
import { SearchModule } from '~/modules/search/search.module'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({ imports: [SearchModule] })
export class AppModule {}
