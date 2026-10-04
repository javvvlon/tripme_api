import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { UserRepository } from '~/modules/auth/repositories/user.repository'
import { SessionRepository } from '~/modules/auth/repositories/session.repository'
import { PasswordService } from './password.service'
import { TokenService } from './token.service'
import { UserRole } from '~/modules/auth/contracts/auth'
import type { ILoginData, ISignupData, ITokenPair } from '~/modules/auth/contracts/auth'
import type { User } from '~/modules/auth/models/User'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IRequestContext {
  userAgent?: string
  ip?: string
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async login(data: ILoginData, context: IRequestContext = {}): Promise<ITokenPair> {
    const user = await this.users.findByEmail(data.email)

    const hash = user?.get('passwordHash') ?? await this.dummyHash()
    const ok = await this.passwords.verify(data.password, hash)

    if (!user || !ok) throw new UnauthorizedException('Invalid email or password')

    return this.tokens.issue(user, context)
  }

  async signup(data: ISignupData, context: IRequestContext = {}): Promise<ITokenPair> {
    if (await this.users.emailExists(data.email)) {
      throw new ConflictException('That email is already registered')
    }

    const user = await this.users.create({
      email: data.email.trim(),
      passwordHash: await this.passwords.hash(data.password),
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      phoneNumber: data.phoneNumber.trim(),
      role: UserRole.Client,
      consentAt: data.consent ? new Date() : null,
    })

    return this.tokens.issue(user, context)
  }

  async refresh(refreshToken: string, context: IRequestContext = {}): Promise<ITokenPair> {
    const session = await this.sessions.findActive(refreshToken)

    if (!session) {
      const reused = await this.sessions.wasUsed(refreshToken)

      if (reused) {
        this.logger.warn(`refresh token replayed for user ${reused.userId}; revoking all sessions`)
        await this.sessions.revokeAllForUser(reused.userId)
      }

      throw new UnauthorizedException('Session expired')
    }

    const user = await this.users.findById(session.userId)
    if (!user) throw new UnauthorizedException('Session expired')

    await this.sessions.revoke(refreshToken)

    return this.tokens.issue(user, context)
  }

  async logout(refreshToken: string | null): Promise<void> {
    if (refreshToken) await this.tokens.revoke(refreshToken)
  }

  async updateProfile(
    userId: string,
    changes: { first_name?: string, last_name?: string, phone_number?: string },
  ): Promise<User> {
    const clean = (value: unknown, limit: number): string | undefined =>
      typeof value === 'string' ? value.trim().slice(0, limit) : undefined

    const next = {
      firstName: clean(changes.first_name, 120),
      lastName: clean(changes.last_name, 120),
      phoneNumber: clean(changes.phone_number, 40),
    }

    if (next.firstName === '') throw new BadRequestException('A first name is required')

    await this.users.updateProfile(userId, Object.fromEntries(
      Object.entries(next).filter(([, value]) => value !== undefined),
    ))

    return this.profile(userId)
  }

  async changePassword(userId: string, current: string, next: string): Promise<void> {
    const user = await this.users.findByIdWithPassword(userId)

    if (!user) throw new NotFoundException('User not found')

    const stored = user.get('passwordHash')

    if (!stored || !await this.passwords.verify(current, stored)) {
      throw new BadRequestException('The current password is wrong')
    }

    if (next.length < 8) throw new BadRequestException('A password needs at least 8 characters')

    await this.users.setPassword(userId, await this.passwords.hash(next))
  }

  async profile(userId: string): Promise<User> {
    const user = await this.users.findById(userId)
    if (!user) throw new NotFoundException('User not found')

    return user
  }

  private dummyHashCache: string | null = null

  private async dummyHash(): Promise<string> {
    this.dummyHashCache ??= await this.passwords.hash(`absent-${Math.random()}`)
    return this.dummyHashCache
  }
}
