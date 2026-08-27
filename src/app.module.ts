import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SearchModule } from '~/modules/search/search.module'
import { ReferencesModule } from '~/modules/references/references.module'
import { AuthModule } from '~/modules/auth/auth.module'
import { ContentModule } from '~/modules/content/content.module'
import { DatabaseModule } from '~/shared/database/database.module'
import { StorageModule } from '~/shared/storage/storage.module'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    StorageModule,
    SearchModule,
    ReferencesModule,
    AuthModule,
    ContentModule,
  ],
})
export class AppModule {}
