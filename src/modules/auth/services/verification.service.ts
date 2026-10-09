import { randomInt } from 'node:crypto'
import { BadRequestException, ConflictException, HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { UserRepository } from '~/modules/auth/repositories/user.repository'
import { VerificationRepository } from '~/modules/auth/repositories/verification.repository'
import type { CodePurpose } from '~/modules/auth/repositories/verification.repository'
import { MESSENGER } from '~/shared/messaging/messenger'
import type { Channel, IMessenger } from '~/shared/messaging/messenger'
import { messageText } from '~/shared/messaging/templates'
import type { MessageKind } from '~/shared/messaging/templates'
import { phoneKey } from '~/shared/helpers/phone'
import { SessionRepository } from '~/modules/auth/repositories/session.repository'
import { PasswordService } from './password.service'
import { TokenService } from './token.service'
import type { ITokenPair } from '~/modules/auth/contracts/auth'
import type { IRequestContext } from './auth.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const CODE_TTL_MINUTES = 15
const MAX_SENDS_PER_HOUR = 5
const MIN_PASSWORD_LENGTH = 8

type Listener = (userId: string, value: string) => Promise<void>

@Injectable()
export class VerificationService {
  private readonly listeners: Record<'phone' | 'email', Listener[]> = { phone: [], email: [] }

  constructor(
    private readonly users: UserRepository,
    private readonly codes: VerificationRepository,
    private readonly tokens: TokenService,
    private readonly sessions: SessionRepository,
    private readonly passwords: PasswordService,
    @Inject(MESSENGER) private readonly messenger: IMessenger,
  ) {}

  onPhoneVerified(listener: Listener): void {
    this.listeners.phone.push(listener)
  }

  onEmailVerified(listener: Listener): void {
    this.listeners.email.push(listener)
  }

  capabilities(): Record<Channel, boolean> {
    return { email: this.messenger.available('email'), sms: this.messenger.available('sms') }
  }

  async send(email: string, locale = 'ru'): Promise<void> {
    const user = await this.users.findByEmail(email)

    if (!user || user.get('isVerified') || user.get('deleted')) return

    const code = await this.issue(user.get('id'), 'email', user.get('email'))

    await this.deliver('email', user.get('email'), 'email_code', locale, code)
  }

  async verify(email: string, code: string, context: IRequestContext = {}): Promise<ITokenPair> {
    const user = await this.users.findByEmail(email)

    const invalid = new BadRequestException('That code is invalid or has expired')

    if (!user) throw invalid
    if (!await this.codes.consume(user.get('id'), code, 'email')) throw invalid

    await this.users.markVerified(user.get('id'))
    await this.notify('email', user.get('id'), user.get('email'))

    return this.tokens.issue(user, context)
  }

  async sendPhoneCode(userId: string, locale = 'ru'): Promise<void> {
    if (!this.messenger.available('sms')) throw new ConflictException('Phone confirmation is not available yet')

    const user = await this.users.findById(userId)

    if (!user) throw new NotFoundException('User not found')

    const phone = phoneKey(user.get('phoneNumber'))

    if (!phone) throw new BadRequestException('Add a phone number first')
    if (user.get('phoneVerified')) return

    const code = await this.issue(userId, 'phone', phone)

    await this.deliver('sms', `+${phone}`, 'phone_code', locale, code)
  }

  async verifyPhone(userId: string, code: string): Promise<void> {
    const user = await this.users.findById(userId)

    if (!user) throw new NotFoundException('User not found')

    const phone = phoneKey(user.get('phoneNumber'))

    if (!phone || !await this.codes.consume(userId, code.trim(), 'phone', phone)) {
      throw new BadRequestException('That code is invalid or has expired')
    }

    await this.users.markPhoneVerified(userId, true)
    await this.notify('phone', userId, phone)
  }

  async sendReset(email: string, locale = 'ru'): Promise<void> {
    if (!this.messenger.available('email')) throw new ConflictException('Password reset is not available yet')

    const user = await this.users.findByEmail(email)

    if (!user || user.get('deleted')) return

    const code = await this.issue(user.get('id'), 'reset', user.get('email'))

    await this.deliver('email', user.get('email'), 'reset_code', locale, code)
  }

  async resetPassword(email: string, code: string, password: string, context: IRequestContext = {}): Promise<ITokenPair> {
    if (password.length < MIN_PASSWORD_LENGTH) throw new BadRequestException('A password needs at least 8 characters')

    const user = await this.users.findByEmail(email)
    const invalid = new BadRequestException('That code is invalid or has expired')

    if (!user || user.get('deleted')) throw invalid
    if (!await this.codes.consume(user.get('id'), code.trim(), 'reset')) throw invalid

    await this.users.setPassword(user.get('id'), await this.passwords.hash(password))
    await this.sessions.revokeAllForUser(user.get('id'))

    return this.tokens.issue(user, context)
  }

  private async issue(userId: string, purpose: CodePurpose, target: string): Promise<string> {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000)

    if (await this.codes.countSince(userId, hourAgo, purpose) >= MAX_SENDS_PER_HOUR) {
      throw new HttpException('Too many codes requested. Try again later.', HttpStatus.TOO_MANY_REQUESTS)
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')

    await this.codes.issue(userId, code, new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000), purpose, target)

    return code
  }

  private async deliver(channel: Channel, to: string, kind: MessageKind, locale: string, code: string): Promise<void> {
    await this.messenger.send({ channel, to, ...messageText(kind, locale, { code }) })
  }

  private async notify(kind: 'phone' | 'email', userId: string, value: string): Promise<void> {
    for (const listener of this.listeners[kind]) await listener(userId, value)
  }
}
