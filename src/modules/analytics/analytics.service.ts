import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, MoreThanOrEqual, Repository } from 'typeorm'
import { LeadEntity } from '~/modules/leads/lead.entity'
import { OrderEntity } from '~/modules/orders/order.entity'
import { OrderEventEntity } from '~/modules/orders/order-event.entity'
import { UserEntity } from '~/modules/auth/entities'
import { RatesService } from '~/modules/references/rates.service'
import { TASHKENT_OFFSET, buildAnalytics } from './analytics.compute'
import type { AnalyticsReport, IAnalyticsLead, IAnalyticsOrder } from './analytics.compute'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IAnalyticsScope {
  from: string
  to: string
  managerId: string | null
}

const TRACKED_EVENTS = ['paid', 'requested', 'cancelled']

const starsFromName = (name: string): number | null => {
  const stars = Number(/(\d)\s*\*/.exec(name)?.[1])

  return stars >= 1 && stars <= 5 ? stars : null
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(LeadEntity) private readonly leads: Repository<LeadEntity>,
    @InjectRepository(OrderEntity) private readonly orders: Repository<OrderEntity>,
    @InjectRepository(OrderEventEntity) private readonly events: Repository<OrderEventEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly rates: RatesService,
  ) {}

  async report(scope: IAnalyticsScope): Promise<AnalyticsReport> {
    const start = new Date(`${scope.from}T00:00:00${TASHKENT_OFFSET}`)
    const end = new Date(`${scope.to}T00:00:00${TASHKENT_OFFSET}`)
    const earliest = new Date(start.getTime() - (end.getTime() - start.getTime()) - 24 * 60 * 60 * 1000)
    const mine = scope.managerId ? { managerId: scope.managerId } : {}

    const [leadRows, orderRows, rates] = await Promise.all([
      this.leads.find({
        where: [
          { ...mine, createdAt: MoreThanOrEqual(earliest) },
          { ...mine, status: 'new' },
        ],
      }),
      this.orders.find({ where: mine }),
      this.rates.current(),
    ])

    const orderIds = orderRows.map(row => row.id)
    const eventRows = orderIds.length
      ? await this.events.find({ where: { orderId: In(orderIds), toStatus: In(TRACKED_EVENTS) } })
      : []

    const managerIds = [...new Set([...leadRows, ...orderRows].map(row => row.managerId).filter((id): id is string => Boolean(id)))]
    const people = managerIds.length
      ? await this.users.find({ where: { id: In(managerIds) }, select: { id: true, firstName: true, lastName: true } })
      : []

    const leads: IAnalyticsLead[] = leadRows.map(row => ({
      id: row.id,
      number: Number(row.orderId ?? 0),
      createdAt: row.createdAt,
      status: row.status,
      channel: row.channel ?? 'site',
      firstResponseAt: row.firstResponseAt,
      managerId: row.managerId,
      rejectReason: row.rejectReason ?? '',
      name: [row.firstName, row.lastName].filter(Boolean).join(' '),
    }))

    const orders: IAnalyticsOrder[] = orderRows.map((row) => {
      const trip = (row.trip ?? {}) as Record<string, unknown>

      return {
        id: row.id,
        number: Number(row.orderNo ?? 0),
        leadId: row.leadId,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        country: row.country || String(trip.route_to ?? ''),
        supplierName: row.supplierName ?? '',
        hotelName: row.hotelName ?? '',
        hotelStars: Number(trip.hotel_stars) || starsFromName(row.hotelName ?? ''),
        travellerName: row.travellerName ?? '',
        priceAmount: row.priceAmount === null ? null : Number(row.priceAmount),
        priceCurrency: row.priceCurrency ?? '',
        checkIn: row.checkIn,
        returnDate: row.returnDate,
        nights: row.nights ?? 0,
        passportExpiresAt: row.passportExpiresAt,
        managerId: row.managerId,
        cancelReason: row.cancelReason ?? '',
      }
    })

    return buildAnalytics({
      from: scope.from,
      to: scope.to,
      now: new Date(),
      leads,
      orders,
      events: eventRows.map(row => ({ orderId: row.orderId, toStatus: row.toStatus, createdAt: row.createdAt })),
      rates: rates.rates,
      managers: new Map(people.map(person => [person.id, [person.firstName, person.lastName].filter(Boolean).join(' ')])),
    })
  }
}
