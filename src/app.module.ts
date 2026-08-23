import { Module } from '@nestjs/common'
import { SearchModule } from '~/modules/search/search.module'
import { ReferencesModule } from '~/modules/references/references.module'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({ imports: [SearchModule, ReferencesModule] })
export class AppModule {}
