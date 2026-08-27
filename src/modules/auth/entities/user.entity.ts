import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { UserRole } from '~/modules/auth/contracts/auth'
import { SessionEntity } from './session.entity'
import { VerificationCodeEntity } from './verification-code.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index({ unique: true })
  @Column({ type: 'text' })
  email!: string

  @Column({ name: 'password_hash', type: 'text', select: false })
  passwordHash!: string

  @Column({ name: 'first_name', type: 'text', default: '' })
  firstName!: string

  @Column({ name: 'last_name', type: 'text', default: '' })
  lastName!: string

  @Column({ name: 'phone_number', type: 'text', default: '' })
  phoneNumber!: string

  @Column({ type: 'text', default: UserRole.Client })
  role!: UserRole

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified!: boolean

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date

  @OneToMany(() => SessionEntity, session => session.user)
  sessions!: SessionEntity[]

  @OneToMany(() => VerificationCodeEntity, code => code.user)
  verificationCodes!: VerificationCodeEntity[]
}
