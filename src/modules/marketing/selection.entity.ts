import { Column, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm'
import type { IAdTemplate } from './templates'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const AD_STYLES = ['classic', 'board', 'ticket', 'custom'] as const

export type AdStyle = typeof AD_STYLES[number]

export const AD_LANGUAGES = ['ru', 'uz'] as const

export type AdLanguage = typeof AD_LANGUAGES[number]

export const AD_ANGLES = ['compare', 'escape', 'timing', 'care'] as const

export type AdAngle = typeof AD_ANGLES[number]

export interface IAdCopy {
  kicker: string
  headline: string
  intro: string
  cta: string
  hashtags: string[]
  ai: boolean
  angle?: AdAngle
}

export const AD_BACKDROPS = ['photo', 'scene', 'type', 'night'] as const

export type AdBackdrop = typeof AD_BACKDROPS[number]

export interface IAdDesign {
  backdrop: AdBackdrop
  dim: number
  focus: number
  rows: number
  stars: boolean
  meal: boolean
  party: boolean
  cta: boolean
  caps: boolean
  price: 'total' | 'person'
  hotel: string
  footer: boolean
  buttons: AdButtons
}

export const AD_BUTTONS = ['both', 'managers', 'link', 'none'] as const

export type AdButtons = typeof AD_BUTTONS[number]

export const DEFAULT_DESIGN: IAdDesign = {
  backdrop: 'scene',
  dim: 55,
  focus: 40,
  rows: 5,
  stars: true,
  meal: true,
  party: true,
  cta: true,
  caps: true,
  price: 'total',
  hotel: '',
  footer: true,
  buttons: 'both',
}

export interface IAdContact {
  id: string
  name: string
  telegram: string
}

export interface IAdPublication {
  at: string
  channel: string
  message_id: number
  language: AdLanguage
  by: string | null
}

export type CheckState = 'same' | 'changed' | 'gone' | 'unknown'

export interface IAdTour {
  [key: string]: unknown
  offer_id: string
  hotel_name: string
  check_in: string
  nights: number
  adults: number
  children: number
  price_amount: number
  price_currency: string
  check_state?: CheckState
  check_was?: number | null
}

export interface IAdBackground {
  url: string
  destination: string
  model: string
  created_at: string
}

@Entity('marketing_selections')
export class MarketingSelectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index({ unique: true })
  @Column({ type: 'text' })
  code!: string

  @Column({ type: 'text', default: '' })
  title!: string

  @Column({ type: 'jsonb', default: () => `'[]'` })
  tours!: IAdTour[]

  @Column({ type: 'jsonb', default: () => `'{}'` })
  copy!: Partial<Record<AdLanguage, IAdCopy>>

  @Column({ type: 'text', default: 'classic' })
  style!: string

  @Column({ type: 'jsonb', nullable: true })
  background!: IAdBackground | null

  @Column({ type: 'jsonb', default: () => `'[]'` })
  backgrounds!: IAdBackground[]

  @Column({ type: 'jsonb', default: () => `'{}'` })
  variants!: Partial<Record<AdLanguage, IAdCopy[]>>

  @Column({ type: 'jsonb', default: () => `'{}'` })
  design!: Partial<IAdDesign>

  @Column({ type: 'jsonb', default: () => `'[]'` })
  contacts!: string[]

  @Column({ type: 'jsonb', default: () => `'[]'` })
  published!: IAdPublication[]

  @Column({ type: 'jsonb', nullable: true })
  template!: IAdTemplate | null

  @Column({ name: 'template_drafts', type: 'jsonb', default: () => `'[]'` })
  templateDrafts!: IAdTemplate[]

  @Column({ name: 'checked_at', type: 'timestamptz', nullable: true })
  checkedAt!: Date | null

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null

  @Column({ name: 'archived_by', type: 'uuid', nullable: true })
  archivedBy!: string | null
}

@Entity('marketing_settings')
export class MarketingSettingsEntity {
  @PrimaryColumn({ type: 'smallint', default: 1 })
  id!: number

  @Column({ type: 'text', default: '' })
  voice!: string

  @Column({ type: 'text', default: '' })
  footer!: string

  @Column({ name: 'footer_uz', type: 'text', default: '' })
  footerUz!: string

  @Column({ type: 'text', default: '' })
  visual!: string

  @Column({ type: 'jsonb', default: () => `'[]'` })
  contacts!: IAdContact[]

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null
}

@Entity('marketing_templates')
export class MarketingTemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'text' })
  name!: string

  @Column({ type: 'jsonb' })
  spec!: IAdTemplate

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null

  @Column({ name: 'archived_by', type: 'uuid', nullable: true })
  archivedBy!: string | null
}
