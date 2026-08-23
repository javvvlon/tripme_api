import { Injectable } from '@nestjs/common'
import { SamoSupplier } from '~/modules/suppliers/samo/samo.supplier'
import { DictionaryService } from '~/modules/suppliers/dictionary/dictionary.service'
import { RoutesService } from '~/modules/suppliers/dictionary/routes.service'
import { SUPPLIER_TRANSPORT } from '~/modules/suppliers/base/tokens'
import { Inject } from '@nestjs/common'
import type { ISupplierTransport, SupplierAccess } from '~/modules/suppliers/base/contracts'
import type { SupplierRef } from '~/modules/search/contracts/search'

/**
 * Kompas Tour (Uzbekistan) — a SAMO operator.
 *
 * Everything specific to them is here: host, the constants their endpoint
 * expects, and how we relate to them. The protocol is inherited.
 *
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class KompastourSupplier extends SamoSupplier {
  readonly ref: SupplierRef = { id: 'kompastour', name: 'Kompas Tour' }

  /**
   * Undocumented: we call the endpoint their own search page calls. It works,
   * it is not a published contract, and nobody will tell us when it changes —
   * so the parser is fixture-tested and this flag tells on-call what to expect.
   * Upgrade to 'agreed' once there is written access (§6).
   */
  readonly access: SupplierAccess = 'undocumented'

  protected readonly baseUrl = 'https://online.uz.kompastour.com/search_tour'

  protected readonly constants: Record<string, string> = {
    STATEFROM: '14',        // Uzbekistan
    FREIGHTTYPE: '0',
    TOURINC: '0',
    PROGRAMGROUPINC: '0',
    FREIGHT: '1',           // only rows with seats left
    FILTER: '0',
    MOMENT_CONFIRM: '0',
    UFILTER: '',
    HOTELTYPES: '',
    PARTITION_PRICE: '160', // meaning unknown; present in their own canonical url
    SHOW_THEBEST: '0',
  }

  constructor(
    @Inject(SUPPLIER_TRANSPORT) transport: ISupplierTransport,
    dictionary: DictionaryService,
    routes: RoutesService,
  ) {
    super(transport, dictionary, routes)
  }
}
