import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Entity('travellers')
export class TravellerEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Column({ name: 'first_name', type: 'text', default: '' })
  firstName!: string

  @Column({ name: 'last_name', type: 'text', default: '' })
  lastName!: string

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate!: string | null

  @Column({ type: 'text', default: '' })
  gender!: string

  @Column({ type: 'text', default: '' })
  citizenship!: string

  @Column({ name: 'passport_number', type: 'text', default: '' })
  passportNumber!: string

  @Column({ name: 'passport_expires_at', type: 'date', nullable: true })
  passportExpiresAt!: string | null

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date
}
