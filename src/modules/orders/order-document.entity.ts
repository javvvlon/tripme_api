import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export enum DocumentKind {
  Offer = 'offer',
  Invoice = 'invoice',
  Attachment = 'attachment',
  Contract = 'contract',
  Voucher = 'voucher',
}

export const DOCUMENT_KINDS = Object.values(DocumentKind)

export const GENERATED_KINDS = [DocumentKind.Offer, DocumentKind.Invoice]

@Entity('order_documents')
export class OrderDocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index()
  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string

  @Column({ type: 'text' })
  kind!: string

  @Column({ type: 'text' })
  name!: string

  @Column({ type: 'text' })
  path!: string

  @Column({ type: 'text' })
  url!: string

  @Column({ type: 'int', default: 0 })
  size!: number

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date
}
