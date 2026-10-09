import { Logger } from '@nestjs/common'
import type { Channel, IMessage, IMessenger } from './messenger'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class LogMessenger implements IMessenger {
  private readonly logger = new Logger('Messenger')

  constructor(private readonly open: Channel[]) {}

  available(channel: Channel): boolean {
    return this.open.includes(channel)
  }

  async send(message: IMessage): Promise<void> {
    this.logger.warn(`no ${message.channel} provider yet — to ${message.to}: ${message.subject} · ${message.text}`)
  }
}

export const devChannels = (): Channel[] =>
  (process.env.MESSAGING_DEV ?? '').split(',').map(value => value.trim()).filter((value): value is Channel => value === 'email' || value === 'sms')
