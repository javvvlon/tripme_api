import { Injectable } from '@nestjs/common'
import { join } from 'node:path'
import { SamoSupplier } from '~/modules/suppliers/samo/samo.supplier'
import { RoutesService } from '~/modules/suppliers/dictionary/routes.service'
import { SUPPLIER_TRANSPORT } from '~/modules/suppliers/base/tokens'
import { Inject } from '@nestjs/common'
import type { ISupplierTransport, SupplierAccess } from '~/modules/suppliers/base/contracts'
import type { SupplierRef } from '~/modules/search/contracts/search'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class KompastourSupplier extends SamoSupplier {
  readonly ref: SupplierRef = { id: 'kompastour', name: 'Kompas Tour' }

  readonly access: SupplierAccess = 'undocumented'

  protected readonly baseUrl = 'https://online.uz.kompastour.com/search_tour'

  protected readonly constants: Record<string, string> = {
    STATEFROM: '14',
    FREIGHTTYPE: '0',
    TOURINC: '0',
    PROGRAMGROUPINC: '0',
    FREIGHT: '1',
    FILTER: '1',
    MOMENT_CONFIRM: '0',
    UFILTER: '',
    HOTELTYPES: '',
    PARTITION_PRICE: '160',
    SHOW_THEBEST: '0',
  }

  constructor(
    @Inject(SUPPLIER_TRANSPORT) transport: ISupplierTransport,
    routes: RoutesService,
  ) {
    super(transport, routes, join(__dirname, '../fixtures/kompastour-refdata.json'))
  }
}
