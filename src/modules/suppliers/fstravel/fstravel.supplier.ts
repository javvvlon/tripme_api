import { Inject, Injectable } from '@nestjs/common'
import { SAMO_CAPABILITIES, SamoSupplier } from '~/modules/suppliers/samo/samo.supplier'
import { RoutesService } from '~/modules/suppliers/dictionary/routes.service'
import { SUPPLIER_TRANSPORT } from '~/modules/suppliers/base/tokens'
import type { ISupplierTransport, SupplierAccess, SupplierCapabilities } from '~/modules/suppliers/base/contracts'
import type { SupplierRef } from '~/modules/search/contracts/search'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class FstravelSupplier extends SamoSupplier {
  readonly ref: SupplierRef = { id: 'fstravel', name: 'FUN&SUN Asia' }

  readonly access: SupplierAccess = 'undocumented'

  protected readonly baseUrl = 'https://b2b.fstravel.asia/search_tour'

  override readonly capabilities: SupplierCapabilities = {
    ...SAMO_CAPABILITIES,
    pageSize: 1000,
    maxPages: 3,
  }

  protected readonly constants: Record<string, string> = {
    STATEFROM: '367404',
    FREIGHTTYPE: '0',
    TOURINC: '0',
    PROGRAMGROUPINC: '0',
    FREIGHT: '1',
    FILTER: '0',
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
