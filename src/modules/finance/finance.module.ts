import { Module } from '@nestjs/common'
import type { OnModuleInit } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '~/modules/auth/auth.module'
import { LeadsModule } from '~/modules/leads/leads.module'
import { OrdersModule } from '~/modules/orders/orders.module'
import { OrdersService } from '~/modules/orders/orders.service'
import { ReferencesModule } from '~/modules/references/references.module'
import { SuppliersModule } from '~/modules/suppliers/suppliers.module'
import { PaymentEntity } from './payment.entity'
import { FinanceService } from './finance.service'
import { OperatorRatesService } from './operator-rates.service'
import { FinanceController } from './finance.controller'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [AuthModule, LeadsModule, OrdersModule, ReferencesModule, SuppliersModule, TypeOrmModule.forFeature([PaymentEntity])],
  controllers: [FinanceController],
  providers: [FinanceService, OperatorRatesService],
  exports: [FinanceService, OperatorRatesService],
})
export class FinanceModule implements OnModuleInit {
  constructor(
    private readonly finance: FinanceService,
    private readonly orders: OrdersService,
  ) {}

  onModuleInit(): void {
    this.orders.registerMoney(orders => this.finance.moneyOf(orders))
    this.orders.registerDocumentGuard(documentId => this.finance.assertNotReceipt(documentId))
  }
}
