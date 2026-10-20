import { Inject, Injectable, Logger } from '@nestjs/common'
import { RatesService } from '~/modules/references/rates.service'
import { SUPPLIERS } from '~/modules/suppliers/base/tokens'
import type { ISupplier } from '~/modules/suppliers/base/contracts'
import { operatorTable } from './finance.rules'
import type { IRateTable, RateTable } from './finance.rules'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const OPERATOR_WAIT_MS = 3000

export interface IOrderRates extends IRateTable {
  date: string | null
}

@Injectable()
export class OperatorRatesService {
  private readonly logger = new Logger(OperatorRatesService.name)

  constructor(
    @Inject(SUPPLIERS) private readonly suppliers: ISupplier[],
    private readonly cbu: RatesService,
  ) {}

  async today(supplierId: string | null): Promise<IOrderRates> {
    const [current, operator] = await Promise.all([
      this.cbu.current().catch(() => null),
      this.operatorRates(supplierId),
    ])

    return { ...operatorTable(operator, current?.rates ?? {}), date: current?.date ?? null }
  }

  async past(day: string): Promise<IOrderRates> {
    const source = await this.cbu.on(day) ?? await this.cbu.current().catch(() => null)

    return { ...operatorTable({}, source?.rates ?? {}), date: source?.date ?? day }
  }

  private async operatorRates(supplierId: string | null): Promise<RateTable> {
    const supplier = supplierId ? this.suppliers.find(item => item.ref.id === supplierId) : undefined

    if (!supplier?.uzsRates) return {}

    let timer: NodeJS.Timeout | undefined

    try {
      return await Promise.race([
        supplier.uzsRates(),
        new Promise<RateTable>((resolve) => {
          timer = setTimeout(() => resolve({}), OPERATOR_WAIT_MS)
          timer.unref()
        }),
      ])
    }
    catch (error) {
      this.logger.warn(`${supplierId} rates unavailable: ${String(error)}`)

      return {}
    }
    finally {
      clearTimeout(timer)
    }
  }
}
