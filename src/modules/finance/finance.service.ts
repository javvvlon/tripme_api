import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { OrdersService } from '~/modules/orders/orders.service'
import type { IOrderMoney, IOrderMoneyInput } from '~/modules/orders/orders.service'
import type { IOrderItemPayload } from '~/modules/orders/items/order-items.service'
import { DocumentsService } from '~/modules/orders/documents/documents.service'
import { RatesService } from '~/modules/references/rates.service'
import { LeadsService } from '~/modules/leads/leads.service'
import { seesEveryone } from '~/modules/leads/lead.access'
import type { IViewer } from '~/modules/leads/lead.access'
import type { IUploadedFile } from '~/shared/storage/storage.service'
import { PaymentEntity } from './payment.entity'
import {
  CUSTOMER_DIRECTIONS, PAYMENT_CURRENCIES, PAYMENT_DIRECTIONS, PAYMENT_METHODS,
  rateFor, summarize, toUzs,
} from './finance.rules'
import { PaymentDirection } from './finance.rules'
import type { IPricedItem } from './finance.rules'

export interface IPaymentInput {
  direction?: string
  amount?: string | number
  currency?: string
  fx_rate?: string | number
  method?: string
  paid_at?: string
  item_id?: string
  note?: string
}

export interface IPaymentPayload {
  uuid: string
  item_id: string | null
  direction: string
  amount: number
  currency: string
  fx_rate: number
  fx_date: string
  amount_uzs: number
  method: string
  paid_at: string
  note: string
  receipt: { name: string, url: string } | null
  reverses: string | null
  reversed: boolean
  recorded_by: string
  created_at: string
}

export interface IFinancePayload {
  total_uzs: number
  missing_rates: number
  received_uzs: number
  balance_uzs: number
  overpaid_uzs: number
  paid_to_suppliers_uzs: number | null
  revenue_uzs: number | null
  deposit_percent: number
  deposit_uzs: number
  deposit_met: boolean
  payment_status: string
  legacy_paid: boolean
  can_reverse: boolean
  payments: IPaymentPayload[]
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const today = (): string => new Date().toISOString().slice(0, 10)

const priced = (items: IOrderItemPayload[]): IPricedItem[] => items.map(item => ({
  status: item.status,
  priceAmount: item.price_amount,
  priceCurrency: item.price_currency,
  fxRate: item.fx_rate,
}))

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(PaymentEntity)
    private readonly payments: Repository<PaymentEntity>,
    private readonly orders: OrdersService,
    private readonly documents: DocumentsService,
    private readonly rates: RatesService,
    private readonly leads: LeadsService,
  ) {}

  async overview(orderId: string, viewer: IViewer): Promise<IFinancePayload> {
    await this.orders.assertVisible(orderId, viewer)

    return this.build(orderId, viewer)
  }

  async record(orderId: string, input: IPaymentInput, file: IUploadedFile | undefined, viewer: IViewer): Promise<IFinancePayload> {
    await this.orders.assertVisible(orderId, viewer)

    const direction = String(input.direction ?? '') as PaymentDirection
    const currency = String(input.currency ?? 'UZS').toUpperCase()
    const amount = Number(String(input.amount ?? '').replace(/\s/g, '').replace(',', '.'))
    const method = String(input.method ?? '')
    const paidAt = ISO_DATE.test(String(input.paid_at ?? '')) ? String(input.paid_at) : today()

    if (!PAYMENT_DIRECTIONS.includes(direction)) throw new BadRequestException('Unknown payment direction')
    if (!PAYMENT_CURRENCIES.includes(currency as typeof PAYMENT_CURRENCIES[number])) throw new BadRequestException('Unsupported currency')
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('The amount must be positive')
    if (!PAYMENT_METHODS.includes(method as never)) throw new BadRequestException('Unknown payment method')
    if (paidAt > today()) throw new BadRequestException('A payment cannot be dated in the future')
    if (CUSTOMER_DIRECTIONS.includes(direction) && !file) throw new BadRequestException('A receipt is required for client money')
    if (!CUSTOMER_DIRECTIONS.includes(direction) && !seesEveryone(viewer)) {
      throw new ForbiddenException('Only a manager records money paid to suppliers')
    }

    const rate = await this.rateOf(currency, input.fx_rate)
    const itemId = await this.itemOf(orderId, input.item_id)
    const receipt = file ? await this.documents.attach(orderId, file, viewer.id) : null

    await this.payments.save(this.payments.create({
      orderId,
      itemId,
      direction,
      amount: String(amount),
      currency,
      fxRate: String(rate),
      fxDate: paidAt,
      amountUzs: String(toUzs(amount, rate)),
      method,
      paidAt,
      receiptDocumentId: receipt?.id ?? null,
      reversesPaymentId: null,
      note: String(input.note ?? '').trim().slice(0, 500),
      recordedBy: viewer.id,
    }))

    if (direction === PaymentDirection.CustomerIn) await this.orders.advance(orderId, viewer.id)

    return this.build(orderId, viewer)
  }

  async reverse(paymentId: string, note: unknown, viewer: IViewer): Promise<IFinancePayload> {
    if (!seesEveryone(viewer)) throw new ForbiddenException('Only a manager can reverse a payment')

    const original = await this.payments.findOne({ where: { id: paymentId } })

    if (!original) throw new NotFoundException('Payment not found')

    await this.orders.assertVisible(original.orderId, viewer)

    if (original.reversesPaymentId) throw new BadRequestException('A reversal cannot be reversed')
    if (await this.payments.exists({ where: { reversesPaymentId: original.id } })) {
      throw new ConflictException('This payment is already reversed')
    }

    await this.payments.save(this.payments.create({
      orderId: original.orderId,
      itemId: original.itemId,
      direction: original.direction,
      amount: String(-Number(original.amount)),
      currency: original.currency,
      fxRate: original.fxRate,
      fxDate: original.fxDate,
      amountUzs: String(-Number(original.amountUzs)),
      method: original.method,
      paidAt: today(),
      receiptDocumentId: null,
      reversesPaymentId: original.id,
      note: typeof note === 'string' ? note.trim().slice(0, 500) : '',
      recordedBy: viewer.id,
    }))

    return this.build(original.orderId, viewer)
  }

  async setDeposit(orderId: string, percent: unknown, viewer: IViewer): Promise<IFinancePayload> {
    await this.orders.setDepositPercent(orderId, percent, viewer)

    return this.build(orderId, viewer)
  }

  async setItemRate(orderId: string, itemId: string, rate: unknown, viewer: IViewer): Promise<IFinancePayload> {
    await this.orders.setItemRate(orderId, itemId, rate, viewer)

    return this.build(orderId, viewer)
  }

  async moneyOf(orders: IOrderMoneyInput[]): Promise<Map<string, IOrderMoney>> {
    const money = new Map<string, IOrderMoney>()

    if (!orders.length) return money

    const rows = await this.payments.find({ where: { orderId: In(orders.map(order => order.id)) } })

    for (const order of orders) {
      const entries = rows
        .filter(row => row.orderId === order.id)
        .map(row => ({ direction: row.direction, amountUzs: Number(row.amountUzs) }))
      const summary = summarize(priced(order.items), entries, order.depositPercent, order.legacyPaid)

      money.set(order.id, {
        paymentStatus: summary.paymentStatus,
        balanceUzs: summary.balanceUzs,
        receivedUzs: summary.receivedUzs,
        depositUzs: summary.depositUzs,
        depositMet: summary.depositMet,
      })
    }

    return money
  }

  async firstClientPayments(orderIds: string[]): Promise<Map<string, Date>> {
    const first = new Map<string, Date>()

    if (!orderIds.length) return first

    const rows = await this.payments.find({
      where: { orderId: In(orderIds), direction: PaymentDirection.CustomerIn },
      order: { createdAt: 'ASC' },
    })
    const reversed = new Set(rows.map(row => row.reversesPaymentId).filter(Boolean))

    for (const row of rows) {
      if (row.reversesPaymentId || reversed.has(row.id)) continue
      if (!first.has(row.orderId)) first.set(row.orderId, row.createdAt)
    }

    return first
  }

  async assertNotReceipt(documentId: string): Promise<void> {
    if (await this.payments.exists({ where: { receiptDocumentId: documentId } })) {
      throw new ConflictException('A payment receipt cannot be deleted')
    }
  }

  async assertNoPayments(orderId: string): Promise<void> {
    if (await this.payments.exists({ where: { orderId } })) {
      throw new ConflictException('An order with recorded payments cannot be deleted')
    }
  }

  private async build(orderId: string, viewer: IViewer): Promise<IFinancePayload> {
    const [items, rows, context, documents] = await Promise.all([
      this.orders.itemsOf(orderId),
      this.payments.find({ where: { orderId }, order: { createdAt: 'ASC' } }),
      this.orders.moneyContextOf(orderId),
      this.documents.list(orderId),
    ])

    const summary = summarize(
      priced(items),
      rows.map(row => ({ direction: row.direction, amountUzs: Number(row.amountUzs) })),
      context.depositPercent,
      context.legacyPaid,
    )
    const elevated = seesEveryone(viewer)
    const reversed = new Set(rows.map(row => row.reversesPaymentId).filter(Boolean))
    const receipts = new Map(documents.map(document => [document.id, { name: document.name, url: document.url }]))
    const names = await this.leads.namesOf(rows.map(row => row.recordedBy))

    return {
      total_uzs: summary.totalUzs,
      missing_rates: summary.missingRates,
      received_uzs: summary.receivedUzs,
      balance_uzs: summary.balanceUzs,
      overpaid_uzs: summary.overpaidUzs,
      paid_to_suppliers_uzs: elevated ? summary.paidToSuppliersUzs : null,
      revenue_uzs: elevated ? summary.revenueUzs : null,
      deposit_percent: summary.depositPercent,
      deposit_uzs: summary.depositUzs,
      deposit_met: summary.depositMet,
      payment_status: summary.paymentStatus,
      legacy_paid: context.legacyPaid,
      can_reverse: elevated,
      payments: rows
        .filter(row => elevated || CUSTOMER_DIRECTIONS.includes(row.direction as PaymentDirection))
        .map(row => ({
          uuid: row.id,
          item_id: row.itemId,
          direction: row.direction,
          amount: Number(row.amount),
          currency: row.currency,
          fx_rate: Number(row.fxRate),
          fx_date: row.fxDate,
          amount_uzs: Number(row.amountUzs),
          method: row.method,
          paid_at: row.paidAt,
          note: row.note,
          receipt: row.receiptDocumentId ? receipts.get(row.receiptDocumentId) ?? null : null,
          reverses: row.reversesPaymentId,
          reversed: reversed.has(row.id),
          recorded_by: row.recordedBy ? names.get(row.recordedBy) ?? '' : '',
          created_at: row.createdAt.toISOString(),
        })),
    }
  }

  private async rateOf(currency: string, given: unknown): Promise<number> {
    if (currency === 'UZS') return 1

    const typed = Number(String(given ?? '').replace(/\s/g, '').replace(',', '.'))

    if (given !== undefined && given !== '' && Number.isFinite(typed) && typed > 0) return typed

    const current = await this.rates.current().catch(() => null)
    const rate = current ? rateFor(currency, current.rates) : null

    if (!rate) throw new BadRequestException('No exchange rate available — enter the rate used')

    return rate
  }

  private async itemOf(orderId: string, itemId: unknown): Promise<string | null> {
    if (typeof itemId !== 'string' || !itemId) return null

    const items = await this.orders.itemsOf(orderId)

    if (!items.some(item => item.uuid === itemId)) throw new BadRequestException('That service is not part of this order')

    return itemId
  }
}
