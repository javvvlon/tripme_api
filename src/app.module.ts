import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SearchModule } from '~/modules/search/search.module'
import { ReferencesModule } from '~/modules/references/references.module'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [
    /**
     * Loads .env into process.env.
     *
     * Without this Nest reads nothing from the file, and a .env saying
     * SUPPLIER_LIVE=1 sits there looking authoritative while the app quietly
     * runs on fixtures — only command-line variables would work.
     *
     * isGlobal so no module has to import it just to read its own settings.
     */
    ConfigModule.forRoot({ isGlobal: true }),
    SearchModule,
    ReferencesModule,
  ],
})
export class AppModule {}
