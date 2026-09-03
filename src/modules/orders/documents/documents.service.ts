import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { StorageService } from '~/shared/storage/storage.service'
import { LeadEntity, LEAD_TRANSITIONS, LeadStatus } from '~/modules/leads/lead.entity'
import { OrderEntity } from '../order.entity'
import { DocumentKind, OrderDocumentEntity } from '../order-document.entity'
import { buildDocument } from './pdf.builder'
import type { DocumentFlavour } from './pdf.builder'
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

  list(orderId: string): Promise<OrderDocumentEntity[]> {
    return this.documents.find({ where: { orderId }, order: { createdAt: 'DESC' } })
  }

  /**
   * Puts a file an agent chose beside the order.
   *
   * The name is kept for the download but never used as the key: two agents
   * attaching `passport.pdf` must not overwrite each other, and a filename
   * someone typed is a path traversal waiting to happen.
   */
  async attach(orderId: string, file: IUploadedFile, actorId: string | null): Promise<OrderDocumentEntity> {
    await this.orderOrFail(orderId)

    if (!ALLOWED_ATTACHMENTS.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type ${file.mimetype}`)
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new BadRequestException(
        `File is larger than ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB`,
      )
    }

    const stored = await this.storage.upload(file, FOLDER)

    return this.documents.save(this.documents.create({
      orderId,
      kind: DocumentKind.Attachment,
      name: file.originalname.slice(0, 240) || 'file',
      path: stored.path,
      url: stored.url,
      size: file.size,
      createdBy: actorId,
    }))
  }

  /**
   * Builds one of the two documents the system writes itself, stores it, and
   * remembers it against the order.
   *
   * Generating a commercial offer also moves the lead to "КП отправлено" —
   * the one status the system sets on its own, because producing the offer
   * *is* the act that status describes. Nothing money-adjacent is automated:
   * an invoice being issued says nothing about whether it was paid.
   */
  async generate(
    orderId: string,
    flavour: DocumentFlavour,
    actorId: string | null,
  ): Promise<OrderDocumentEntity> {
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
    }, FOLDER)

    const saved = await this.documents.save(this.documents.create({
      orderId,
      kind,
      name,
      path: stored.path,
      url: stored.url,
      size: pdf.length,
      createdBy: actorId,
    }))

    if (flavour === 'offer') await this.followOffer(lead)

    return saved
  }

  async remove(id: string): Promise<void> {
    const document = await this.documents.findOne({ where: { id } })

    if (!document) throw new NotFoundException('Document not found')

    await this.documents.delete({ id })

    /**
     * The record is what the CMS reads, so it goes first. Losing the bytes
     * afterwards leaves an orphan in the bucket; losing the record first
     * would leave a row pointing at nothing.
     */
    try {
      await this.storage.remove(document.url)
    }
    catch (error) {
      this.logger.warn(`could not remove ${document.path}: ${String(error)}`)
    }
  }

  /**
   * The lead follows the offer it just had written for it, and only when
   * that step is one it is allowed to take. A lead already won, or refused,
   * is left exactly where it is.
   */
  private async followOffer(lead: LeadEntity | null): Promise<void> {
    if (!lead) return

    const allowed = LEAD_TRANSITIONS[lead.status as LeadStatus] ?? []

    if (!allowed.includes(LeadStatus.QuoteSent)) return

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
