import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export enum OperatorConnection {
  Mirror = 'mirror',
  Api = 'api',
}

export const OPERATOR_CONNECTIONS = Object.values(OperatorConnection)

@Entity('operators')
export class OperatorEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index({ unique: true })
  @Column({ type: 'text' })
  slug!: string

  @Column({ type: 'text' })
  name!: string

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled!: boolean

  @Column({ type: 'text', default: OperatorConnection.Mirror })
  connection!: string

  @Column({ name: 'site_url', type: 'text', default: '' })
  siteUrl!: string

  @Column({ name: 'api_base_url', type: 'text', default: '' })
  apiBaseUrl!: string

  @Column({ name: 'api_key', type: 'text', default: '', select: false })
  apiKey!: string

  @Column({ name: 'api_secret', type: 'text', default: '', select: false })
  apiSecret!: string

  @Column({ name: 'api_login', type: 'text', default: '' })
  apiLogin!: string

  @Column({ type: 'text', default: '' })
  note!: string

  @Column({ type: 'int', default: 0 })
  position!: number

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date
}
