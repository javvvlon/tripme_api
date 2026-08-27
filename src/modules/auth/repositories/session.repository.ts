import { createHash } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, LessThan, MoreThan, Not, Repository } from 'typeorm'
import { SessionEntity } from '~/modules/auth/entities'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class SessionRepository {
  constructor(
    @InjectRepository(SessionEntity)
    private readonly sessions: Repository<SessionEntity>,
  ) {}

  static hash(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  async create(
    userId: string,
    token: string,
    expiresAt: Date,
    context: { userAgent?: string, ip?: string } = {},
  ): Promise<SessionEntity> {
    return this.sessions.save(this.sessions.create({
      userId,
      tokenHash: SessionRepository.hash(token),
      expiresAt,
      userAgent: context.userAgent ?? null,
      ip: context.ip ?? null,
    }))
  }

  async findActive(token: string): Promise<SessionEntity | null> {
    return this.sessions.findOne({
      where: {
        tokenHash: SessionRepository.hash(token),
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    })
  }

  async revoke(token: string): Promise<void> {
    await this.sessions.update(
      { tokenHash: SessionRepository.hash(token), revokedAt: IsNull() },
      { revokedAt: new Date() },
    )
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.sessions.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() })
  }

  async wasUsed(token: string): Promise<{ userId: string } | null> {
    const session = await this.sessions.findOne({
      where: { tokenHash: SessionRepository.hash(token), revokedAt: Not(IsNull()) },
      select: { userId: true },
    })

    return session ? { userId: session.userId } : null
  }

  async deleteExpired(): Promise<number> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const { affected } = await this.sessions.delete({ expiresAt: LessThan(cutoff) })

    return affected ?? 0
  }
}
