import { join } from 'node:path'
import { Module } from '@nestjs/common'
import { RoutesService } from './dictionary/routes.service'
import { KompastourSupplier } from './kompastour/kompastour.supplier'
import { EasybookingSupplier } from './easybooking/easybooking.supplier'
import { SelfietravelSupplier } from './selfietravel/selfietravel.supplier'
import { FstravelSupplier } from './fstravel/fstravel.supplier'
import { PrestigeSupplier } from './prestige/prestige.supplier'
import { FlykhivaSupplier } from './flykhiva/flykhiva.supplier'
import { MalvaSupplier } from './malva/malva.supplier'
import { RightflightSupplier } from './rightflight/rightflight.supplier'
import { AquatravelSupplier } from './aquatravel/aquatravel.supplier'
import { CrystalbaySupplier } from './crystalbay/crystalbay.supplier'
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
    FlykhivaSupplier,
    MalvaSupplier,
    RightflightSupplier,
    AquatravelSupplier,
    CrystalbaySupplier,
    {
      provide: SUPPLIERS,
      useFactory: (
        kompas: KompastourSupplier,
        easybooking: EasybookingSupplier,
        selfie: SelfietravelSupplier,
        fstravel: FstravelSupplier,
        prestige: PrestigeSupplier,
        flykhiva: FlykhivaSupplier,
        malva: MalvaSupplier,
        rightflight: RightflightSupplier,
        aquatravel: AquatravelSupplier,
        crystalbay: CrystalbaySupplier,
      ): ISupplier[] => [kompas, easybooking, selfie, fstravel, prestige, flykhiva, malva, rightflight, aquatravel, crystalbay],
      inject: [KompastourSupplier, EasybookingSupplier, SelfietravelSupplier, FstravelSupplier, PrestigeSupplier, FlykhivaSupplier, MalvaSupplier, RightflightSupplier, AquatravelSupplier, CrystalbaySupplier],
    },
  ],
  exports: [SUPPLIERS, RoutesService],
})
export class SuppliersModule {}
