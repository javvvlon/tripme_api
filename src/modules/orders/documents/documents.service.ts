import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { StorageService } from '~/shared/storage/storage.service'
import { LeadEntity, LEAD_TRANSITIONS, LeadStatus } from '~/modules/leads/lead.entity'
import { LeadEventEntity, LeadEventKind } from '~/modules/leads/lead-event.entity'
import { OrderEntity } from '../order.entity'
import { DocumentKind, OrderDocumentEntity } from '../order-document.entity'
import { buildDocument } from './pdf.builder'
import type { DocumentFlavour } from './pdf.builder'
import type { IDocumentMoney } from './document-lines'
import type { IUploadedFile } from '~/shared/storage/storage.service'

/**
 * @author Javlon Khalimjonov Khalimjonov <khalimjanov2000@gmail.com>
 */
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024

export const ALLOWED_ATTACHMENTS = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

const FOLDER = 'documents'

export interface IDocumentPayload {
  id: string
  order_id: string
  kind: string
  name: string
  url: string
  size: number
  created_at: string
}

export function toDocumentPayload(row: OrderDocumentEntity): IDocumentPayload {
  return {
    id: row.id,
    order_id: row.orderId,
    kind: row.kind,
    name: row.name,
    url: row.url,
    size: Number(row.size ?? 0),
    created_at: (row.createdAt ?? new Date()).toISOString(),
  }
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name)

  constructor(
    private readonly storage: StorageService,
    @InjectRepository(OrderDocumentEntity)
    private readonly documents: Repository<OrderDocumentEntity>,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    @InjectRepository(LeadEntity)
    private readonly leads: Repository<LeadEntity>,
  ) {}

  async list(orderId: string): Promise<IDocumentPayload[]> {
    const rows = await this.documents.find({ where: { orderId }, order: { createdAt: 'DESC' } })

    return rows.map(row => toDocumentPayload(row))
  }

  async attach(
    orderId: string,
    file: IUploadedFile,
    actorId: string | null,
    kind: DocumentKind = DocumentKind.Attachment,
  ): Promise<IDocumentPayload> {
    await this.orderOrFail(orderId)

    if (!ALLOWED_ATTACHMENTS.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type ${file.mimetype}`)
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new BadRequestException(
        `File is larger than ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB`,
      )
    }

    const stored = await this.storage.upload(file, FOLDER, {
      allowed: ALLOWED_ATTACHMENTS,
      maxBytes: MAX_ATTACHMENT_BYTES,
    })

    const saved = await this.documents.save(this.documents.create({
      orderId,
      kind,
      name: file.originalname.slice(0, 240) || 'file',
      path: stored.path,
      url: stored.url,
      size: file.size,
      createdBy: actorId,
    }))

    return toDocumentPayload(saved)
  }

  async generate(
    orderId: string,
    flavour: DocumentFlavour,
    actorId: string | null,
    money?: IDocumentMoney,
  ): Promise<IDocumentPayload> {
    const order = await this.orderOrFail(orderId)
    const lead = await this.leads.findOne({ where: { id: order.leadId } })

    const trip = (order.trip ?? {}) as Record<string, unknown>
    const text = (value: unknown): string => (typeof value === 'string' ? value : '')

    const pdf = await buildDocument(flavour, {
      number: String(order.orderNo),
      issuedOn: new Date(),
      client: {
        name: order.travellerName
          || [lead?.firstName, lead?.lastName].filter(Boolean).join(' ')
          || '',
        phone: lead?.phone ?? '',
      },
      trip: {
        country: order.country,
        hotel: order.hotelName,
        supplier: order.supplierName,
        checkIn: order.checkIn,
        returnDate: order.returnDate,
        nights: order.nights,
        adults: order.adults,
        children: order.children,
        room: text(trip.room_name),
        meal: text(trip.meal_name),
      },
      totals: {
        amount: order.priceAmount === null ? null : Number(order.priceAmount),
        currency: order.priceCurrency || 'USD',
      },
      money,
      note: order.note,
      supplierOrderId: order.supplierOrderId,
    })

    const kind = flavour === 'offer' ? DocumentKind.Offer : DocumentKind.Invoice
    const name = `${flavour === 'offer' ? 'КП' : 'Счёт'}-${order.orderNo}.pdf`

    const stored = await this.storage.upload({
      buffer: pdf,
      mimetype: 'application/pdf',
      originalname: name,
      size: pdf.length,
    }, FOLDER, { allowed: ['application/pdf'], maxBytes: MAX_ATTACHMENT_BYTES })

    const saved = await this.documents.save(this.documents.create({
      orderId,
      kind,
      name,
      path: stored.path,
      url: stored.url,
      size: pdf.length,
      createdBy: actorId,
    }))

    if (flavour === 'offer') await this.followOffer(lead, actorId)

    return toDocumentPayload(saved)
  }

  async orderIdOf(id: string): Promise<string> {
    const document = await this.documents.findOne({ where: { id }, select: { id: true, orderId: true } })

    if (!document) throw new NotFoundException('Document not found')

    return document.orderId
  }

  async find(id: string): Promise<OrderDocumentEntity | null> {
    return this.documents.findOne({ where: { id } })
  }

  async remove(id: string): Promise<void> {
    const document = await this.documents.findOne({ where: { id } })

    if (!document) throw new NotFoundException('Document not found')

    await this.documents.delete({ id })

    try {
      await this.storage.remove(document.url)
    }
    catch (error) {
      this.logger.warn(`could not remove ${document.path}: ${String(error)}`)
    }
  }

  private async followOffer(lead: LeadEntity | null, actorId: string | null): Promise<void> {
    if (!lead) return

    const allowed = LEAD_TRANSITIONS[lead.status as LeadStatus] ?? []

    if (!allowed.includes(LeadStatus.QuoteSent)) return

    await this.leads.manager.getRepository(LeadEventEntity).save({
      leadId: lead.id,
      kind: LeadEventKind.Status,
      fromValue: lead.status,
      toValue: LeadStatus.QuoteSent,
      actorId,
    })

    lead.status = LeadStatus.QuoteSent
    lead.updatedAt = new Date()

    await this.leads.save(lead)
  }

  private async orderOrFail(id: string): Promise<OrderEntity> {
    const order = await this.orders.findOne({ where: { id } })

    if (!order) throw new NotFoundException('Order not found')

    return order
  }
}
