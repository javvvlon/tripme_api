import { Controller, Get, Inject, Query } from '@nestjs/common'
import { SUPPLIERS } from '~/modules/suppliers/base/tokens'
import { CalendarService } from './calendar.service'
import { RouteLookupService } from './route-lookup.service'
import { RatesService } from './rates.service'
import type { ISupplier } from '~/modules/suppliers/base/contracts'
import { isProductMode } from '~/modules/search/contracts/search'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const FALLBACK = { nights: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], maxAdults: 4, maxChildren: 3 }

const STAY_NIGHTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]

@Controller('references')
export class ReferencesController {
  constructor(
    @Inject(SUPPLIERS) private readonly suppliers: ISupplier[],
    private readonly calendar: CalendarService,
    private readonly routes: RouteLookupService,
    private readonly rates: RatesService,
  ) {}

  @Get('rates')
  async rates_() {
    return this.rates.display()
  }

  @Get('departures')
  async departures() {
    return this.routes.departures()
  }

  @Get('suppliers')
  suppliers_() {
    return {
      items: this.suppliers.map(supplier => ({
        id: supplier.ref.id,
        name: supplier.ref.name,
        access: supplier.access,
      })),
    }
  }

  @Get('countries')
  async countries(@Query('from') from?: string, @Query('mode') mode?: string) {
    return isProductMode(mode) ? this.routes.productCountries(mode) : this.routes.countriesFrom(from)
  }

  @Get('constraints')
  async constraints(@Query('from') from?: string, @Query('to') to?: string, @Query('mode') mode?: string) {
    if (isProductMode(mode)) {
      return {
        nights: STAY_NIGHTS,
        maxAdults: FALLBACK.maxAdults,
        maxChildren: FALLBACK.maxChildren,
        currencies: ['USD', 'EUR', 'UZS'],
        calendar: null,
      }
    }

    const facts = await this.calendar.factsFor(from, to)

    return {
      nights: facts?.nights.length ? facts.nights : FALLBACK.nights,
      maxAdults: facts?.maxAdults ?? FALLBACK.maxAdults,
      maxChildren: facts?.maxChildren ?? FALLBACK.maxChildren,
      currencies: ['USD', 'EUR', 'UZS'],
      calendar: await this.calendar.forRoute(from, to),
    }
  }
}
