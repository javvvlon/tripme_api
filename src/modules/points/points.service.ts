import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { EntityManager, In, Repository } from 'typeorm'
import { LeadEntity } from '~/modules/leads/lead.entity'
import { OrderEntity } from '~/modules/orders/order.entity'
import { UserEntity } from '~/modules/auth/entities'
import { UserRole } from '~/modules/auth/contracts/auth'
import {
  DEFAULT_RATES, POINTS_CURRENCIES, PointsReason,
  PointsSettingsEntity, PointsTierEntity, PointsTransactionEntity,
} from './points.entities'
import type { PointsCurrency, PointsRates } from './points.entities'
import { ORDER_PREFIX, reference } from '~/shared/helpers/reference'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface ITierPayload {
  id: string
  name: string
  threshold: number
  discount_percent: number
}

export interface ITierInput {
  name?: string
  threshold?: number
  discount_percent?: number
}

export interface IPointsSummary {
  balance: number
  earned: number
  tier: ITierPayload | null
  next: ITierPayload | null
  to_next: number
}

export interface IPointsTransactionPayload {
  id: string
  delta: number
  reason: string
  order_id: string | null
  order_no: number | null
  order_ref: string | null
  note: string
  created_at: string
}

export interface ICustomerPoints {
  user: { id: string, name: string, email: string }
  summary: IPointsSummary
  history: IPointsTransactionPayload[]
}

const SETTINGS_ID = 1

export const resolveTier = (tiers: ITierPayload[], balance: number): Pick<IPointsSummary, 'tier' | 'next' | 'to_next'> => {
  const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold)
  const tier = sorted.filter(candidate => candidate.threshold <= balance).at(-1) ?? null
  const next = sorted.find(candidate => candidate.threshold > balance) ?? null

  return { tier, next, to_next: next ? next.threshold - balance : 0 }
}

export const pointsFor = (amount: number | null, currency: string, rates: PointsRates): number => {
  if (amount === null) return 0

  const rate = rates[currency.toUpperCase() as PointsCurrency] ?? 0

  return Math.max(0, Math.round(amount * rate))
}

const toTier = (row: PointsTierEntity): ITierPayload => ({
  id: row.id,
  name: row.name,
  threshold: row.threshold,
  discount_percent: Number(row.discountPercent),
})

@Injectable()
export class PointsService {
  constructor(
    @InjectRepository(PointsTierEntity)
    private readonly tiersRepo: Repository<PointsTierEntity>,
    @InjectRepository(PointsSettingsEntity)
    private readonly settingsRepo: Repository<PointsSettingsEntity>,
    @InjectRepository(PointsTransactionEntity)
    private readonly transactions: Repository<PointsTransactionEntity>,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    @InjectRepository(LeadEntity)
    private readonly leads: Repository<LeadEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  async tiers(): Promise<ITierPayload[]> {
    const rows = await this.tiersRepo.find({ order: { threshold: 'ASC' } })

    return rows.map(toTier)
  }

  async createTier(input: ITierInput): Promise<ITierPayload> {
    const row = this.tiersRepo.create({
      name: this.tierName(input.name),
      threshold: this.threshold(input.threshold),
      discountPercent: String(this.percent(input.discount_percent)),
    })

    return toTier(await this.tiersRepo.save(row))
  }

  async patchTier(id: string, input: ITierInput): Promise<ITierPayload> {
    const row = await this.tiersRepo.findOne({ where: { id } })

    if (!row) throw new NotFoundException('Tier not found')

    if (input.name !== undefined) row.name = this.tierName(input.name)
    if (input.threshold !== undefined) row.threshold = this.threshold(input.threshold)
    if (input.discount_percent !== undefined) row.discountPercent = String(this.percent(input.discount_percent))

    row.updatedAt = new Date()

    return toTier(await this.tiersRepo.save(row))
  }

  async removeTier(id: string): Promise<void> {
    const result = await this.tiersRepo.delete({ id })

    if (!result.affected) throw new NotFoundException('Tier not found')
  }

  async rates(): Promise<PointsRates> {
    const row = await this.settingsRepo.findOne({ where: { id: SETTINGS_ID } })

    return { ...DEFAULT_RATES, ...(row?.rates ?? {}) }
  }

  async updateRates(input: Partial<Record<string, unknown>>): Promise<PointsRates> {
    const current = await this.rates()

    for (const currency of POINTS_CURRENCIES) {
      const value = input[currency]

      if (value === undefined) continue

      const rate = Number(value)

      if (!Number.isFinite(rate) || rate < 0) throw new BadRequestException(`Rate for ${currency} must be a number of points per unit`)

      current[currency] = rate
    }

    await this.settingsRepo.save({ id: SETTINGS_ID, rates: current, updatedAt: new Date() })

    return current
  }

  async summary(userId: string): Promise<IPointsSummary> {
    const [totals, tiers] = await Promise.all([
      this.transactions
        .createQueryBuilder('t')
        .select('coalesce(sum(t.delta), 0)', 'balance')
        .addSelect('coalesce(sum(case when t.delta > 0 then t.delta else 0 end), 0)', 'earned')
        .where('t.user_id = :userId', { userId })
        .getRawOne<{ balance: string, earned: string }>(),
      this.tiers(),
    ])

    const balance = Number(totals?.balance ?? 0)
    const earned = Number(totals?.earned ?? 0)

    return { balance, earned, ...resolveTier(tiers, balance) }
  }

  async history(userId: string): Promise<IPointsTransactionPayload[]> {
    const rows = await this.transactions.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 200 })
    const orderIds = [...new Set(rows.map(row => row.orderId).filter((id): id is string => Boolean(id)))]

    const numbers = new Map<string, number>()
    const refs = new Map<string, string>()

    if (orderIds.length) {
      const found = await this.orders.find({ where: { id: In(orderIds) }, select: { id: true, orderNo: true, createdAt: true } })

      for (const order of found) {
        numbers.set(order.id, Number(order.orderNo))
        refs.set(order.id, reference(ORDER_PREFIX, Number(order.orderNo), order.createdAt))
      }
    }

    return rows.map(row => ({
      id: row.id,
      delta: row.delta,
      reason: row.reason,
      order_id: row.orderId,
      order_no: row.orderId ? numbers.get(row.orderId) ?? null : null,
      order_ref: row.orderId ? refs.get(row.orderId) ?? null : null,
      note: row.note,
      created_at: row.createdAt.toISOString(),
    }))
  }

  async customer(userId: string): Promise<ICustomerPoints> {
    const user = await this.users.findOne({ where: { id: userId } })

    if (!user || user.role !== UserRole.Client) throw new NotFoundException('Customer not found')

    const [summary, history] = await Promise.all([this.summary(userId), this.history(userId)])

    return {
      user: {
        id: user.id,
        name: [user.firstName, user.lastName].filter(Boolean).join(' '),
        email: user.email,
      },
      summary,
      history,
    }
  }

  async adjust(userId: string, delta: number, note: string, actorId: string | null): Promise<ICustomerPoints> {
    const amount = Math.trunc(Number(delta))

    if (!Number.isFinite(amount) || amount === 0) throw new BadRequestException('An adjustment needs a non-zero amount')

    const user = await this.users.findOne({ where: { id: userId } })

    if (!user || user.role !== UserRole.Client) throw new NotFoundException('Customer not found')

    const { balance } = await this.summary(userId)

    if (balance + amount < 0) throw new BadRequestException('The balance cannot go below zero')

    await this.transactions.save(this.transactions.create({
      userId,
      delta: amount,
      reason: PointsReason.Adjustment,
      orderId: null,
      note: (note ?? '').trim().slice(0, 500),
      actorId,
    }))

    return this.customer(userId)
  }

  async awardFor(order: OrderEntity, manager?: EntityManager): Promise<number> {
    const leads = manager ? manager.getRepository(LeadEntity) : this.leads
    const transactions = manager ? manager.getRepository(PointsTransactionEntity) : this.transactions

    const lead = await leads.findOne({ where: { id: order.leadId }, select: { id: true, userId: true } })

    if (!lead?.userId) return 0

    const already = await transactions.findOne({ where: { orderId: order.id, reason: PointsReason.Order } })

    if (already) return 0

    const points = pointsFor(
      order.priceAmount === null ? null : Number(order.priceAmount),
      order.priceCurrency || 'USD',
      await this.rates(),
    )

    if (points <= 0) return 0

    await transactions.save(transactions.create({
      userId: lead.userId,
      delta: points,
      reason: PointsReason.Order,
      orderId: order.id,
      note: '',
      actorId: null,
    }))

    return points
  }

  private tierName(value: unknown): string {
    const name = typeof value === 'string' ? value.trim().slice(0, 60) : ''

    if (!name) throw new BadRequestException('A tier needs a name')

    return name
  }

  private threshold(value: unknown): number {
    const threshold = Math.trunc(Number(value))

    if (!Number.isFinite(threshold) || threshold < 0) throw new BadRequestException('A threshold must be zero or more points')

    return threshold
  }

  private percent(value: unknown): number {
    const percent = Math.round(Number(value) * 100) / 100

    if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new BadRequestException('A discount must be between 0 and 100 percent')

    return percent
  }
}
