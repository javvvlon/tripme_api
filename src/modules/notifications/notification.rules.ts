import type { Channel } from '~/shared/messaging/messenger'
import type { MessageKind } from '~/shared/messaging/templates'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IReach {
  email: string | null
  phone: string | null
  open: Record<Channel, boolean>
}

export function routeOf(reach: IReach): { channel: Channel, to: string } | null {
  if (reach.email && reach.open.email) return { channel: 'email', to: reach.email }
  if (reach.phone && reach.open.sms) return { channel: 'sms', to: reach.phone }

  return null
}

const STATUS_MESSAGES: Record<string, MessageKind> = {
  confirmed: 'order_confirmed',
  issued: 'order_issued',
  cancelled: 'order_cancelled',
}

export const statusMessage = (status: string): MessageKind | null => STATUS_MESSAGES[status] ?? null

export const sumText = (amount: number): string => `${Math.round(amount).toLocaleString('ru-RU').replace(/ /g, ' ')} сум`
