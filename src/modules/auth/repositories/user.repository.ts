import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { UserEntity } from '~/modules/auth/entities'
import { User } from '~/modules/auth/models/User'
import type { UserRole } from '~/modules/auth/contracts/auth'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface ICreateUser {
  email: string
  passwordHash: string
  firstName: string
  lastName: string
  phoneNumber: string
  role: UserRole
  consentAt?: Date | null
}

export const normaliseEmail = (email: string): string => email.trim().toLowerCase()

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    const entity = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: normaliseEmail(email) })
      .getOne()

    return entity ? User.fromRaw(entity) : null
  }

  async findById(id: string): Promise<User | null> {
    const entity = await this.users.findOne({ where: { id } })

    return entity ? User.fromRaw(entity) : null
  }

  async create(data: ICreateUser): Promise<User> {
    const entity = this.users.create({ ...data, email: normaliseEmail(data.email) })

    return User.fromRaw(await this.users.save(entity))
  }

  async updateProfile(
    id: string,
    changes: { firstName?: string, lastName?: string, phoneNumber?: string },
  ): Promise<void> {
    await this.users.update({ id }, changes)
  }

  async findByIdWithPassword(id: string): Promise<User | null> {
    const entity = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne()

    return entity ? User.fromRaw(entity) : null
  }

  async setPassword(id: string, passwordHash: string): Promise<void> {
    await this.users.update({ id }, { passwordHash })
  }

  async markVerified(id: string): Promise<void> {
    await this.users.update({ id }, { isVerified: true })
  }

  async markPhoneVerified(id: string, verified: boolean): Promise<void> {
    await this.users.update({ id }, { phoneVerifiedAt: verified ? new Date() : null })
  }

  async anonymise(id: string, passwordHash: string): Promise<void> {
    await this.users.update({ id }, {
      email: `deleted-${id}@tripme.invalid`,
      firstName: '',
      lastName: '',
      phoneNumber: '',
      passwordHash,
      isVerified: false,
      phoneVerifiedAt: null,
      consentAt: null,
      deletedAt: new Date(),
    })
  }

  async emailExists(email: string): Promise<boolean> {
    return this.users.existsBy({ email: normaliseEmail(email) })
  }
}
