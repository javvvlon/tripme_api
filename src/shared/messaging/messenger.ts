/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export type Channel = 'email' | 'sms'

export interface IMessage {
  channel: Channel
  to: string
  subject: string
  text: string
}

export interface IMessenger {
  available(channel: Channel): boolean
  send(message: IMessage): Promise<void>
}

export const MESSENGER = Symbol('MESSENGER')
