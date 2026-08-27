import { createHash } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm'
import { VerificationCodeEntity } from '~/modules/auth/entities'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class VerificationRepository {
  constructor(
    @InjectRepository(VerificationCodeEntity)
    private readonly codes: Repository<VerificationCodeEntity>,
    private readonly dataSource: DataSource,
  ) {}

  static hash(code: string): string {
    return createHash('sha256').update(code).digest('hex')
  }

  async issue(userId: string, code: string, expiresAt: Date): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const codes = manager.getRepository(VerificationCodeEntity)

      await codes.update({ userId, consumedAt: IsNull() }, { consumedAt: new Date() })
      await codes.save(codes.create({
        userId,
        codeHash: VerificationRepository.hash(code),
        expiresAt,
      }))
    })
  }

  async consume(userId: string, code: string): Promise<boolean> {
    const { affected } = await this.codes.update(
      {
        userId,
        codeHash: VerificationRepository.hash(code),
        consumedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      { consumedAt: new Date() },
    )

    return (affected ?? 0) > 0
  }

  async countSince(userId: string, since: Date): Promise<number> {
    return this.codes.countBy({ userId, createdAt: MoreThan(since) })
  }
}
