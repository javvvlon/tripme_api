import { join } from 'node:path'
import { Module } from '@nestjs/common'
import { DictionaryService } from './dictionary/dictionary.service'
import { RoutesService } from './dictionary/routes.service'
import { KompastourSupplier } from './kompastour/kompastour.supplier'
import { FixtureTransport, HttpTransport } from './base/transport'
import { SUPPLIER_TRANSPORT, SUPPLIERS } from './base/tokens'
import type { ISupplier } from './base/contracts'

/**
 * Which suppliers exist, and how they talk to the outside world.
 *
 * The transport is chosen here, once. With SUPPLIER_LIVE unset the whole
 * pipeline replays a saved response and never touches anyone's server — which
 * is the first milestone (§8 stage 1: «всё на условных поставщиках»), and also
 * how this runs in CI.
 *
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  providers: [
    DictionaryService,
    RoutesService,
    {
      provide: SUPPLIER_TRANSPORT,
      useFactory: () =>
        process.env.SUPPLIER_LIVE === '1'
          ? new HttpTransport()
          : new FixtureTransport(join(__dirname, 'fixtures'), {
              1: 'kompastour-tashkent-turkey-p1.txt',
            }),
    },
    KompastourSupplier,
    {
      provide: SUPPLIERS,
      useFactory: (kompas: KompastourSupplier): ISupplier[] => [kompas],
      inject: [KompastourSupplier],
    },
  ],
  exports: [SUPPLIERS, DictionaryService, RoutesService],
})
export class SuppliersModule {}
