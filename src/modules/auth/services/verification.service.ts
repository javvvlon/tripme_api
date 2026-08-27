import { randomInt } from 'node:crypto'
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'
import { BadRequestException } from '@nestjs/common'
import { UserRepository } from '~/modules/auth/repositories/user.repository'
import { VerificationRepository } from '~/modules/auth/repositories/verification.repository'
import { TokenService } from './token.service'
import type { ITokenPair } from '~/modules/auth/contracts/auth'
import type { IRequestContext } from './auth.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const CODE_TTL_MINUTES = 15
const MAX_SENDS_PER_HOUR = 5

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name)

  constructor(
    private readonly users: UserRepository,
    private readonly codes: VerificationRepository,
    private readonly tokens: TokenService,
  ) {}

  async send(email: string): Promise<void> {
    const user = await this.users.findByEmail(email)

    if (!user || user.get('isVerified')) return

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000)

    if (await this.codes.countSince(user.get('id'), hourAgo) >= MAX_SENDS_PER_HOUR) {
      throw new HttpException('Too many codes requested. Try again later.', HttpStatus.TOO_MANY_REQUESTS)
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')

    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000)
    await this.codes.issue(user.get('id'), code, expiresAt)

    await this.deliver(email, code)
  }

  async verify(email: string, code: string, context: IRequestContext = {}): Promise<ITokenPair> {
    const user = await this.users.findByEmail(email)

    const invalid = new BadRequestException('That code is invalid or has expired')

    if (!user) throw invalid
    if (!await this.codes.consume(user.get('id'), code)) throw invalid

    await this.users.markVerified(user.get('id'))

    return this.tokens.issue(user, context)
  }

  private async deliver(email: string, code: string): Promise<void> {
    this.logger.warn(`no mail transport configured — verification code for ${email} is ${code}`)
  }
}
