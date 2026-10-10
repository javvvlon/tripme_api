import { Inject, Injectable } from '@nestjs/common'
import { SamoSupplier } from '~/modules/suppliers/samo/samo.supplier'
import { RoutesService } from '~/modules/suppliers/dictionary/routes.service'
import { SUPPLIER_TRANSPORT } from '~/modules/suppliers/base/tokens'
import type { ISupplierTransport, SupplierAccess } from '~/modules/suppliers/base/contracts'
import type { SupplierRef } from '~/modules/search/contracts/search'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class SelfietravelSupplier extends SamoSupplier {
  readonly ref: SupplierRef = { id: 'selfietravel', name: 'Selfie Travel' }

  readonly access: SupplierAccess = 'undocumented'

  protected readonly baseUrl = 'https://b2b.selfietravel.kz/search_tour'

  protected readonly constants: Record<string, string> = {
    FREIGHTTYPE: '0',
    TOURINC: '0',
    PROGRAMGROUPINC: '0',
    FREIGHT: '1',
    FILTER: '1',
    MOMENT_CONFIRM: '0',
    UFILTER: '',
    HOTELTYPES: '',
    SHOW_THEBEST: '0',
  }

  constructor(
    @Inject(SUPPLIER_TRANSPORT) transport: ISupplierTransport,
    routes: RoutesService,
  ) {
    super(transport, routes)
  }
}
