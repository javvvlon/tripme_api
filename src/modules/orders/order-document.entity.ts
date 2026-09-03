import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export enum DocumentKind {
  /** The offer sent to a client before anything is booked. */
  Offer = 'offer',
  /** The bill for a confirmed booking. */
  Invoice = 'invoice',
  /** Anything the agent attached themselves: a passport scan, a voucher. */
  Attachment = 'attachment',
}

export const DOCUMENT_KINDS = Object.values(DocumentKind)

/** The two the system produces itself. */
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

  /** What it is called when downloaded. */
  @Column({ type: 'text' })
  name!: string

  /** The object key, so the file can be deleted with the record. */
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
