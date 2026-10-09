import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Between, Repository } from 'typeorm'
import { RatesService } from '~/modules/references/rates.service'
import { pageOf } from '~/shared/helpers/pagination'
import type { IPage, IPageRequest } from '~/shared/helpers/pagination'
import { EsimPurchaseEntity } from './purchase.entity'
import { ESIM_PROVIDER } from './provider/esim-provider'
import type { IEsimPlan, IEsimProvider } from './provider/esim-provider'
import { PAYMENT_GATEWAYS } from './payments/gateway'
import type { IPaymentGateway } from './payments/gateway'
import type { IPayablePurchase, IPaymentStatePatch, IPurchasePayments } from './payments/purchase-payments.port'
import { orderUrl } from './esim.links'
import {
  PURCHASE_STATUSES,
  PurchaseStatus,
  checkoutOf,
  expired,
  marginPercent,
  maskEmail,
  newToken,
  retailUzs,
} from './esim.rules'
import type { ICheckoutInput } from './esim.rules'

export interface IEsimCountryPayload {
  code: string
  plans: number
  from_uzs: number
}

export interface IEsimPlanPayload {
  id: string
  country: string
  data_gb: number | null
  days: number
  networks: string[]
  price_uzs: number
}

export interface IEsimPurchasePayload {
  token: string
  number: number
  status: string
  country: string
  plan: IEsimPlanPayload
  price_uzs: number
  email: string
  method: string
  pay_url: string | null
  esim: Record<string, unknown> | null
  created_at: string
}

export interface IEsimPurchaseRow {
  id: string
  number: number
  status: string
  country: string
  plan_title: string
  price_uzs: number
  margin_uzs: number
  email: string
  phone: string
  method: string
  provider: string
  issue_error: string
  issue_attempts: number
  paid_at: string | null
  created_at: string
}

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class EsimService implements IPurchasePayments {
  private readonly logger = new Logger(EsimService.name)

  constructor(
    @InjectRepository(EsimPurchaseEntity)
    private readonly purchases: Repository<EsimPurchaseEntity>,
    @Inject(ESIM_PROVIDER)
    private readonly source: IEsimProvider | null,
    @Inject(PAYMENT_GATEWAYS)
    private readonly gateways: IPaymentGateway[],
    private readonly rates: RatesService,
  ) {}

  private get provider(): IEsimProvider {
    if (!this.source) throw new NotFoundException('eSIM is not available yet')

    return this.source
  }

  async countries(): Promise<IEsimCountryPayload[]> {
    if (!this.source) return []

    const [countries, rate] = await Promise.all([this.provider.countries(), this.usdRate()])
    const margin = marginPercent()

    return countries.map(country => ({ code: country.code, plans: country.plans, from_uzs: retailUzs(country.fromUsd, rate, margin) }))
  }

  async plans(country: string): Promise<IEsimPlanPayload[]> {
    if (!/^[a-z]{2}$/i.test(country)) throw new NotFoundException('Country not found')

    const [plans, rate] = await Promise.all([this.provider.plans(country), this.usdRate()])

    if (!plans.length) throw new NotFoundException('Country not found')

    const margin = marginPercent()

    return plans
      .map(plan => this.planPayload(plan, retailUzs(plan.wholesaleUsd, rate, margin)))
      .sort((a, b) => a.price_uzs - b.price_uzs)
  }

  methods(): Array<{ method: string, sandbox: boolean }> {
    return this.gateways.map(gateway => ({ method: gateway.method, sandbox: gateway.sandbox }))
  }

  async checkout(input: ICheckoutInput, userId: string | null = null): Promise<IEsimPurchasePayload> {
    const checkout = checkoutOf(input ?? {})
    const plan = await this.provider.plan(checkout.planId)

    if (!plan) throw new BadRequestException('This tariff is no longer available')

    const gateway = this.gatewayFor(checkout.method)
    const rate = await this.usdRate()
    const margin = marginPercent()

    const saved = await this.purchases.save(this.purchases.create({
      token: newToken(),
      status: PurchaseStatus.AwaitingPayment,
      country: plan.country,
      planId: plan.id,
      plan: { ...plan },
      provider: this.provider.name,
      wholesaleUsd: String(plan.wholesaleUsd),
      fxRate: String(rate),
      marginPercent: String(margin),
      priceUzs: String(retailUzs(plan.wholesaleUsd, rate, margin)),
      email: checkout.email,
      userId,
      phone: checkout.phone,
      locale: checkout.locale,
      paymentMethod: gateway.method,
    }))

    const fresh = await this.purchases.findOneOrFail({ where: { id: saved.id } })

    return this.payload(fresh)
  }

  async byToken(token: string): Promise<IEsimPurchasePayload> {
    return this.payload(await this.foundByToken(token))
  }

  async sandboxPay(token: string, outcome: unknown): Promise<IEsimPurchasePayload> {
    const purchase = await this.foundByToken(token)

    if (!this.gatewayFor(purchase.paymentMethod).sandbox) throw new NotFoundException('Purchase not found')

    if (outcome === 'paid') await this.markPaid(purchase.id)
    else await this.markCancelled(purchase.id)

    return this.byToken(token)
  }

  async page(request: IPageRequest, status?: string, q?: string): Promise<IPage<IEsimPurchaseRow, Record<string, number>>> {
    const builder = this.purchases.createQueryBuilder('p').orderBy('p.number', 'DESC')

    if (status && PURCHASE_STATUSES.includes(status as PurchaseStatus)) builder.andWhere('p.status = :status', { status })

    const needle = (q ?? '').trim().toLowerCase()

    if (needle) {
      builder.andWhere('(lower(p.email) like :like or p.phone like :like or cast(p.number as text) like :like or lower(p.country) like :like)', { like: `%${needle}%` })
    }

    const [rows, total] = await builder.skip(request.skip).take(request.perPage).getManyAndCount()
    const counted = await this.purchases.createQueryBuilder('p').select('p.status', 'status').addSelect('count(*)', 'n').groupBy('p.status').getRawMany<{ status: string, n: string }>()
    const counts: Record<string, number> = Object.fromEntries(counted.map(row => [row.status, Number(row.n)]))

    return pageOf(rows.map(row => this.row(row)), total, request, counts)
  }

  async retry(id: string): Promise<IEsimPurchaseRow> {
    const purchase = await this.purchases.findOne({ where: { id } })

    if (!purchase) throw new NotFoundException('Purchase not found')
    if (purchase.status !== PurchaseStatus.IssueFailed) throw new ConflictException('Only a failed eSIM can be issued again')

    await this.purchases.update({ id }, { status: PurchaseStatus.Paid, updatedAt: new Date() })
    await this.fulfil(id)

    return this.row(await this.purchases.findOneOrFail({ where: { id } }))
  }

  async byNumber(number: number): Promise<IPayablePurchase | null> {
    if (!Number.isSafeInteger(number) || number <= 0) return null

    const row = await this.purchases.findOne({ where: { number: String(number) } })

    return row ? this.payable(row) : null
  }

  async byTxn(txn: string): Promise<IPayablePurchase | null> {
    const row = await this.purchases.findOne({ where: { paymentTxn: txn } })

    return row ? this.payable(row) : null
  }

  async between(fromMs: number, toMs: number, method: string): Promise<IPayablePurchase[]> {
    const rows = await this.purchases.find({
      where: { paymentMethod: method, paymentCreatedMs: Between(String(fromMs), String(toMs)) },
      order: { paymentCreatedMs: 'ASC' },
    })

    return rows.map(row => this.payable(row))
  }

  async record(id: string, patch: IPaymentStatePatch): Promise<void> {
    const purchase = await this.purchases.findOne({ where: { id } })

    if (!purchase) throw new NotFoundException('Purchase not found')

    const big = (value: number | null | undefined) => (value === null || value === undefined ? null : String(value))

    if (patch.txn !== undefined) purchase.paymentTxn = patch.txn
    if (patch.state !== undefined) purchase.paymentState = patch.state
    if (patch.createdMs !== undefined) purchase.paymentCreatedMs = big(patch.createdMs)
    if (patch.performedMs !== undefined) purchase.paymentPerformedMs = big(patch.performedMs)
    if (patch.cancelledMs !== undefined) purchase.paymentCancelledMs = big(patch.cancelledMs)
    if (patch.cancelReason !== undefined) purchase.paymentCancelReason = patch.cancelReason

    purchase.updatedAt = new Date()

    await this.purchases.save(purchase)
  }

  async markPaid(id: string): Promise<void> {
    const moved = await this.purchases
      .createQueryBuilder()
      .update(EsimPurchaseEntity)
      .set({ status: PurchaseStatus.Paid, paidAt: () => 'now()', updatedAt: () => 'now()' })
      .where('id = :id and status = :from', { id, from: PurchaseStatus.AwaitingPayment })
      .execute()

    if (!moved.affected) return

    void this.fulfil(id)
  }

  async markCancelled(id: string): Promise<void> {
    await this.purchases
      .createQueryBuilder()
      .update(EsimPurchaseEntity)
      .set({ status: PurchaseStatus.Cancelled, updatedAt: () => 'now()' })
      .where('id = :id and status = :from', { id, from: PurchaseStatus.AwaitingPayment })
      .execute()
  }

  private readonly issuedListeners: Array<(purchase: EsimPurchaseEntity) => Promise<void>> = []

  onIssued(listener: (purchase: EsimPurchaseEntity) => Promise<void>): void {
    this.issuedListeners.push(listener)
  }

  private async fulfil(id: string): Promise<void> {
    const purchase = await this.purchases.findOne({ where: { id } })

    if (!purchase || purchase.status !== PurchaseStatus.Paid) return

    if (!this.source) return

    let issued = false

    const plan = (await this.provider.plan(purchase.planId)) ?? (purchase.plan as unknown as IEsimPlan)

    try {
      const esim = await this.provider.issue(plan, `ESIM-${purchase.number}`)

      issued = true

      Object.assign(purchase, {
        status: PurchaseStatus.Issued,
        esim: { ...esim },
        issueError: '',
      })
    }
    catch (error) {
      this.logger.error(`eSIM ${purchase.number} was paid but not issued: ${(error as Error).message}`)

      Object.assign(purchase, {
        status: PurchaseStatus.IssueFailed,
        issueError: String((error as Error).message ?? error).slice(0, 500),
      })
    }

    purchase.issueAttempts += 1
    purchase.updatedAt = new Date()

    await this.purchases.save(purchase)

    if (issued) {
      for (const listener of this.issuedListeners) await listener(purchase).catch(() => undefined)
    }
  }

  private gatewayFor(method: string): IPaymentGateway {
    const gateway = this.gateways.find(entry => entry.method === method)

    if (!gateway) throw new BadRequestException('This payment method is not available')

    return gateway
  }

  private async foundByToken(token: string): Promise<EsimPurchaseEntity> {
    const purchase = /^[\w-]{16,64}$/.test(token) ? await this.purchases.findOne({ where: { token } }) : null

    if (!purchase) throw new NotFoundException('Purchase not found')

    if (expired(purchase.status, purchase.createdAt)) {
      await this.markCancelled(purchase.id)
      purchase.status = PurchaseStatus.Cancelled
    }

    return purchase
  }

  private async usdRate(): Promise<number> {
    const current = await this.rates.current()
    const rate = current.rates.USD

    if (!rate) throw new ConflictException('The exchange rate is unavailable, try again shortly')

    return rate
  }

  private planPayload(plan: IEsimPlan, priceUzs: number): IEsimPlanPayload {
    return {
      id: plan.id,
      country: plan.country,
      data_gb: plan.dataMb === null ? null : Math.round(plan.dataMb / 1024 * 10) / 10,
      days: plan.days,
      networks: plan.networks,
      price_uzs: priceUzs,
    }
  }

  private payload(row: EsimPurchaseEntity): IEsimPurchasePayload {
    const awaiting = row.status === PurchaseStatus.AwaitingPayment
    const price = Number(row.priceUzs)
    const gateway = this.gateways.find(entry => entry.method === row.paymentMethod)

    return {
      token: row.token,
      number: Number(row.number),
      status: row.status,
      country: row.country,
      plan: this.planPayload(row.plan as unknown as IEsimPlan, price),
      price_uzs: price,
      email: maskEmail(row.email),
      method: row.paymentMethod,
      pay_url: awaiting && gateway
        ? gateway.startUrl({ purchaseNumber: Number(row.number), token: row.token, amountUzs: price, returnUrl: orderUrl(row.locale, row.token), locale: row.locale })
        : null,
      esim: row.status === PurchaseStatus.Issued ? row.esim : null,
      created_at: row.createdAt.toISOString(),
    }
  }

  private payable(row: EsimPurchaseEntity): IPayablePurchase {
    const num = (value: string | null) => (value === null ? null : Number(value))

    return {
      id: row.id,
      number: Number(row.number),
      status: expired(row.status, row.createdAt) ? PurchaseStatus.Cancelled : row.status,
      method: row.paymentMethod,
      amountUzs: Number(row.priceUzs),
      createdAt: row.createdAt,
      txn: row.paymentTxn,
      state: row.paymentState,
      createdMs: num(row.paymentCreatedMs),
      performedMs: num(row.paymentPerformedMs),
      cancelledMs: num(row.paymentCancelledMs),
      cancelReason: row.paymentCancelReason,
    }
  }

  private row(row: EsimPurchaseEntity): IEsimPurchaseRow {
    const plan = row.plan as unknown as IEsimPlan
    const price = Number(row.priceUzs)
    const cost = Math.round(Number(row.wholesaleUsd) * Number(row.fxRate))

    return {
      id: row.id,
      number: Number(row.number),
      status: expired(row.status, row.createdAt) ? PurchaseStatus.Cancelled : row.status,
      country: row.country,
      plan_title: plan?.title ?? row.planId,
      price_uzs: price,
      margin_uzs: price - cost,
      email: row.email,
      phone: row.phone,
      method: row.paymentMethod,
      provider: row.provider,
      issue_error: row.issueError,
      issue_attempts: row.issueAttempts,
      paid_at: row.paidAt ? row.paidAt.toISOString() : null,
      created_at: row.createdAt.toISOString(),
    }
  }
}
