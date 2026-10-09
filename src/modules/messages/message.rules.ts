import { BadRequestException } from '@nestjs/common'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export enum AuthorRole {
  Client = 'client',
  Staff = 'staff',
  System = 'system',
}

export const MAX_MESSAGE_LENGTH = 2000

export function messageBody(raw: unknown): string {
  const body = typeof raw === 'string' ? raw.replace(/\r\n/g, '\n').trim() : ''

  if (!body) throw new BadRequestException('A message cannot be empty')
  if (body.length > MAX_MESSAGE_LENGTH) throw new BadRequestException(`A message is at most ${MAX_MESSAGE_LENGTH} characters`)

  return body
}

export const unreadFor = (
  messages: Array<{ authorRole: string, createdAt: Date }>,
  reader: 'client' | 'staff',
  readAt: Date | null,
): number => messages.filter(message =>
  (reader === 'client' ? message.authorRole !== AuthorRole.Client : message.authorRole === AuthorRole.Client)
  && (!readAt || message.createdAt > readAt)).length
