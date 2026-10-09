import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, IsNull, Repository } from 'typeorm'
import { LeadEntity } from '~/modules/leads/lead.entity'
import { OrderEntity } from '~/modules/orders/order.entity'
import { OrderEventEntity } from '~/modules/orders/order-event.entity'
import { UserEntity } from '~/modules/auth/entities'
import { DocumentsService } from '~/modules/orders/documents/documents.service'
import type { IDocumentPayload } from '~/modules/orders/documents/documents.service'
import { LEAD_PREFIX, ORDER_PREFIX, reference } from '~/shared/helpers/reference'
import { phoneKey } from '~/shared/helpers/phone'
import { OrdersService } from '~/modules/orders/orders.service'
import { EsimPurchaseEntity } from '~/modules/esim/purchase.entity'
import { TravellerEntity } from './traveller.entity'
import { travellerOf, travellerPayload } from './traveller.rules'
import { MessagesService } from '~/modules/messages/messages.service'
import { DocumentKind } from '~/modules/orders/order-document.entity'
import type { IUploadedFile } from '~/shared/storage/storage.service'
import type { ITravellerInput, ITravellerPayload } from './traveller.rules'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface ICustomerOrder {
  uuid: string
  order_no: number
  ref: string
  status: string
  country: string
  hotel_name: string
  supplier_name: string
  check_in: string | null
  return_date: string | null
  nights: number
  adults: number
  children: number
  price_amount: number | null
  price_currency: string
  supplier_order_id: string
  manager: { name: string } | null
  total_uzs: number
  payment_status: string
  created_at: string
  updated_at: string
}

export interface ICustomerOrderDetail extends ICustomerOrder {
  history: Array<{ from: string | null, to: string, at: string }>
  documents: IDocumentPayload[]
  services: Array<{ kind: string, title: string, when: string, price: string, uzs: number | null }>
  total_uzs: number
  received_uzs: number
  balance_uzs: number
  payment_status: string
}

export interface ICustomerRequest {
  uuid: string
  ref: string
  status: string
  destination: string
  hotel_name: string
  check_in: string | null
  nights: number
  orders: number
  created_at: string
}

export interface ICustomerEsim {
  token: string
  number: number
  status: string
  country: string
  plan: Record<string, unknown>
  price_uzs: number
  created_at: string
}

const UPLOAD_NOTES: Record<string, string> = {
  ru: 'Загрузил(а) документ «{name}» к заказу {ref}',
  uz: '{ref} buyurtmaga «{name}» hujjatini yukladi',
  en: 'Uploaded «{name}» to order {ref}',
}

const uploadNote = (locale: string, name: string, ref: string): string =>
  (UPLOAD_NOTES[locale] ?? UPLOAD_NOTES.ru!).replace('{name}', name).replace('{ref}', ref)

@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(LeadEntity)
    private readonly leads: Repository<LeadEntity>,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    @InjectRepository(OrderEventEntity)
    private readonly events: Repository<OrderEventEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(TravellerEntity)
    private readonly travellers: Repository<TravellerEntity>,
    @InjectRepository(EsimPurchaseEntity)
    private readonly esims: Repository<EsimPurchaseEntity>,
    private readonly documents: DocumentsService,
    private readonly ordersService: OrdersService,
    private readonly messages: MessagesService,
  ) {}

  async uploadDocument(userId: string, orderId: string, file: IUploadedFile): Promise<IDocumentPayload> {
    const { order, lead } = await this.ownedOrder(userId, orderId)
    const document = await this.documents.attach(orderId, file, userId, DocumentKind.ClientUpload)
    const ref = reference(ORDER_PREFIX, Number(order.orderNo ?? 0), order.createdAt)

    await this.messages.postAsClient(userId, uploadNote(lead.locale, document.name, ref)).catch(() => undefined)

    return document
  }

  async removeDocument(userId: string, documentId: string): Promise<void> {
    const document = await this.documents.find(documentId)

    if (!document || document.kind !== DocumentKind.ClientUpload || document.createdBy !== userId) {
      throw new NotFoundException('Document not found')
    }

    await this.ownedOrder(userId, document.orderId)
    await this.documents.remove(documentId)
  }

  private async ownedOrder(userId: string, orderId: string): Promise<{ order: OrderEntity, lead: LeadEntity }> {
    const order = await this.orders.findOne({ where: { id: orderId } })

    if (!order || order.archivedAt) throw new NotFoundException('Order not found')

    const lead = await this.leads.findOne({ where: { id: order.leadId } })

    if (!lead || lead.userId !== userId || lead.archivedAt) throw new NotFoundException('Order not found')

    return { order, lead }
  }

  async list(userId: string): Promise<ICustomerOrder[]> {
    const leads = await this.leads.find({ where: { userId, archivedAt: IsNull() }, select: { id: true } })

    if (!leads.length) return []

    const rows = await this.orders.find({
      where: { leadId: In(leads.map(lead => lead.id)), archivedAt: IsNull() },
      order: { createdAt: 'DESC' },
    })

    const managers = await this.managersFor(rows)
    const money = await Promise.all(rows.map(row => this.ordersService.customerMoney(row.id).catch(() => null)))

    return rows.map((row, i) => ({
      ...this.toPayload(row, managers),
      total_uzs: money[i]?.totalUzs ?? 0,
      payment_status: money[i]?.paymentStatus ?? 'unpaid',
    }))
  }

  async one(userId: string, orderId: string): Promise<ICustomerOrderDetail> {
    const row = await this.orders.findOne({ where: { id: orderId } })

    if (!row || row.archivedAt) throw new NotFoundException('Order not found')

    const lead = await this.leads.findOne({ where: { id: row.leadId }, select: { id: true, userId: true, archivedAt: true } })

    if (!lead || lead.userId !== userId || lead.archivedAt) throw new NotFoundException('Order not found')

    const [managers, events, documents, money] = await Promise.all([
      this.managersFor([row]),
      this.events.find({ where: { orderId }, order: { createdAt: 'ASC' } }),
      this.documents.list(orderId),
      this.ordersService.customerMoney(orderId),
    ])

    return {
      ...this.toPayload(row, managers),
      services: money.lines,
      total_uzs: money.totalUzs,
      received_uzs: money.receivedUzs,
      balance_uzs: money.balanceUzs,
      payment_status: money.paymentStatus,
      history: events.map(event => ({
        from: event.fromStatus,
        to: event.toStatus,
        at: event.createdAt.toISOString(),
      })),
      documents,
    }
  }

  async requests(userId: string): Promise<ICustomerRequest[]> {
    const rows = await this.leads.find({ where: { userId, archivedAt: IsNull() }, order: { createdAt: 'DESC' } })

    if (!rows.length) return []

    const counts = await this.orders
      .createQueryBuilder('o')
      .select('o.leadId', 'lead')
      .addSelect('count(*)', 'n')
      .where('o.leadId in (:...ids)', { ids: rows.map(row => row.id) })
      .andWhere('o.archivedAt is null')
      .groupBy('o.leadId')
      .getRawMany<{ lead: string, n: string }>()
    const byLead = new Map(counts.map(row => [row.lead, Number(row.n)]))

    return rows.map(row => ({
      uuid: row.id,
      ref: reference(LEAD_PREFIX, Number(row.orderId ?? 0), row.createdAt),
      status: row.status,
      destination: row.destination ?? '',
      hotel_name: row.hotelName ?? '',
      check_in: row.checkIn ?? null,
      nights: row.nights ?? 0,
      orders: byLead.get(row.id) ?? 0,
      created_at: row.createdAt.toISOString(),
    }))
  }

  async esimPurchases(userId: string): Promise<ICustomerEsim[]> {
    const rows = await this.esims.find({ where: { userId }, order: { createdAt: 'DESC' } })

    return rows.map(row => ({
      token: row.token,
      number: Number(row.number),
      status: row.status,
      country: row.country,
      plan: row.plan,
      price_uzs: Number(row.priceUzs),
      created_at: row.createdAt.toISOString(),
    }))
  }

  async travellersOf(userId: string): Promise<ITravellerPayload[]> {
    const rows = await this.travellers.find({ where: { userId }, order: { createdAt: 'ASC' } })

    return rows.map(travellerPayload)
  }

  async addTraveller(userId: string, input: ITravellerInput): Promise<ITravellerPayload> {
    if (await this.travellers.countBy({ userId }) >= 20) throw new BadRequestException('Up to 20 travellers per account')

    const saved = await this.travellers.save(this.travellers.create({ ...travellerOf(input), userId }))

    return travellerPayload(saved)
  }

  async updateTraveller(userId: string, id: string, input: ITravellerInput): Promise<ITravellerPayload> {
    const row = await this.travellers.findOne({ where: { id, userId } })

    if (!row) throw new NotFoundException('Traveller not found')

    Object.assign(row, travellerOf(input, row), { updatedAt: new Date() })

    return travellerPayload(await this.travellers.save(row))
  }

  async removeTraveller(userId: string, id: string): Promise<void> {
    const { affected } = await this.travellers.delete({ id, userId })

    if (!affected) throw new NotFoundException('Traveller not found')
  }

  async travellersForLead(leadId: string): Promise<ITravellerPayload[]> {
    const lead = await this.leads.findOne({ where: { id: leadId }, select: { id: true, userId: true } })

    return lead?.userId ? this.travellersOf(lead.userId) : []
  }

  async linkByPhone(userId: string, phone: string): Promise<number> {
    const key = phoneKey(phone)

    if (!key) return 0

    const result = await this.leads
      .createQueryBuilder()
      .update(LeadEntity)
      .set({ userId })
      .where('user_id is null')
      .andWhere(`(case when length(regexp_replace(phone, '\\D', '', 'g')) = 9 then '998' || regexp_replace(phone, '\\D', '', 'g') else regexp_replace(phone, '\\D', '', 'g') end) = :key`, { key })
      .execute()

    return result.affected ?? 0
  }

  async linkEsimByEmail(userId: string, email: string): Promise<void> {
    await this.esims
      .createQueryBuilder()
      .update(EsimPurchaseEntity)
      .set({ userId })
      .where('user_id is null and lower(email) = :email', { email: email.toLowerCase() })
      .execute()
  }

  async forget(userId: string): Promise<void> {
    await this.leads.update({ userId }, { userId: null })
    await this.esims.update({ userId }, { userId: null })
    await this.travellers.delete({ userId })
  }

  private async managersFor(rows: OrderEntity[]): Promise<Map<string, string>> {
    const ids = [...new Set(rows.map(row => row.managerId).filter((id): id is string => Boolean(id)))]

    if (!ids.length) return new Map()

    const found = await this.users.find({ where: { id: In(ids) }, select: { id: true, firstName: true, lastName: true } })

    return new Map(found.map(user => [user.id, [user.firstName, user.lastName].filter(Boolean).join(' ')]))
  }

  private toPayload(row: OrderEntity, managers: Map<string, string>): ICustomerOrder {
    const manager = row.managerId ? managers.get(row.managerId) : undefined

    return {
      uuid: row.id,
      order_no: Number(row.orderNo ?? 0),
      ref: reference(ORDER_PREFIX, Number(row.orderNo ?? 0), row.createdAt),
      status: row.status,
      country: row.country ?? '',
      hotel_name: row.hotelName ?? '',
      supplier_name: row.supplierName ?? '',
      check_in: row.checkIn,
      return_date: row.returnDate,
      nights: row.nights ?? 0,
      adults: row.adults ?? 0,
      children: row.children ?? 0,
      price_amount: row.priceAmount === null ? null : Number(row.priceAmount),
      price_currency: row.priceCurrency ?? '',
      supplier_order_id: row.supplierOrderId ?? '',
      manager: manager ? { name: manager } : null,
      total_uzs: 0,
      payment_status: 'unpaid',
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    }
  }
}
