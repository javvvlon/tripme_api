import { join } from 'node:path'
import { Module } from '@nestjs/common'
import { RoutesService } from './dictionary/routes.service'
import { KompastourSupplier } from './kompastour/kompastour.supplier'
import { EasybookingSupplier } from './easybooking/easybooking.supplier'
import { SelfietravelSupplier } from './selfietravel/selfietravel.supplier'
import { FstravelSupplier } from './fstravel/fstravel.supplier'
import { PrestigeSupplier } from './prestige/prestige.supplier'
import { FixtureTransport, HttpTransport } from './base/transport'
import { SUPPLIER_TRANSPORT, SUPPLIERS } from './base/tokens'
import type { ISupplier } from './base/contracts'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  providers: [
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
    EasybookingSupplier,
    SelfietravelSupplier,
    FstravelSupplier,
    PrestigeSupplier,
    {
      provide: SUPPLIERS,
      useFactory: (
        kompas: KompastourSupplier,
        easybooking: EasybookingSupplier,
        selfie: SelfietravelSupplier,
        fstravel: FstravelSupplier,
        prestige: PrestigeSupplier,
      ): ISupplier[] => [kompas, easybooking, selfie, fstravel, prestige],
      inject: [KompastourSupplier, EasybookingSupplier, SelfietravelSupplier, FstravelSupplier, PrestigeSupplier],
    },
  ],
  exports: [SUPPLIERS, RoutesService],
})
export class SuppliersModule {}
