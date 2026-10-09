import { Inject, Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { MESSENGER } from '~/shared/messaging/messenger'
import type { IMessenger } from '~/shared/messaging/messenger'
import { messageText, threadText } from '~/shared/messaging/templates'
import type { MessageKind } from '~/shared/messaging/templates'
import { ORDER_PREFIX, reference } from '~/shared/helpers/reference'
import { phoneKey } from '~/shared/helpers/phone'
import { UserEntity } from '~/modules/auth/entities'
import { LeadEntity } from '~/modules/leads/lead.entity'
import { OrderEntity } from '~/modules/orders/order.entity'
import { OrderItemEntity } from '~/modules/orders/items/order-item.entity'
import { siteUrl } from '~/modules/esim/esim.links'
import type { EsimPurchaseEntity } from '~/modules/esim/purchase.entity'
import type { OrderEvent } from '~/modules/orders/orders.service'
import { MessagesService } from '~/modules/messages/messages.service'
import { routeOf, statusMessage, sumText } from './notification.rules'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    @InjectRepository(OrderEntity) private readonly orders: Repository<OrderEntity>,
    @InjectRepository(LeadEntity) private readonly leads: Repository<LeadEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(OrderItemEntity) private readonly items: Repository<OrderItemEntity>,
    @Inject(MESSENGER) private readonly messenger: IMessenger,
    private readonly messages: MessagesService,
  ) {}

  async orderEvent(event: OrderEvent): Promise<void> {
    const order = await this.orders.findOne({ where: { id: event.orderId } })

    if (!order || order.archivedAt) return

    const lead = await this.leads.findOne({ where: { id: order.leadId } })

    if (!lead || lead.archivedAt) return

    const user = lead.userId ? await this.users.findOne({ where: { id: lead.userId } }) : null
    const account = user && !user.deletedAt ? user : null
    const locale = lead.locale || 'ru'
    const params: Record<string, string> = {
      ref: reference(ORDER_PREFIX, Number(order.orderNo ?? 0), order.createdAt),
      link: account ? `${siteUrl()}/${locale}/account/orders/${order.id}` : `${siteUrl()}/${locale}`,
    }

    let kind: MessageKind | null = null

    if (event.type === 'status') kind = statusMessage(event.to)

    if (event.type === 'payment') {
      kind = 'payment_received'
      params.amount = sumText(event.amountUzs)
    }

    if (event.type === 'issued') {
      const item = await this.items.findOne({ where: { id: event.itemId } })

      kind = 'service_issued'
      params.service = item?.title || ''
    }

    if (!kind) return

    if (account) await this.messages.postSystem(account.id, threadText(kind, locale, params), order.id).catch(() => undefined)

    await this.deliver(kind, locale, params, account?.email ?? null, lead.phone)
  }

  async esimIssued(purchase: EsimPurchaseEntity): Promise<void> {
    await this.deliver('esim_ready', purchase.locale || 'ru', {
      number: String(purchase.number),
      link: `${siteUrl()}/${purchase.locale || 'ru'}/esim/order/${purchase.token}`,
    }, purchase.email, purchase.phone)
  }

  private async deliver(kind: MessageKind, locale: string, params: Record<string, string>, email: string | null, phone: string | null): Promise<void> {
    const key = phoneKey(phone)
    const route = routeOf({
      email,
      phone: key ? `+${key}` : null,
      open: { email: this.messenger.available('email'), sms: this.messenger.available('sms') },
    })

    if (!route) {
      this.logger.log(`${kind} for ${params.ref ?? params.number ?? ''} not sent — no open channel`)
      return
    }

    await this.messenger.send({ ...route, ...messageText(kind, locale, params) })
  }
}
