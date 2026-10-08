import { BadRequestException } from '@nestjs/common'
import { randomBytes } from 'node:crypto'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export enum PurchaseStatus {
  AwaitingPayment = 'awaiting_payment',
  Paid = 'paid',
  Issued = 'issued',
  IssueFailed = 'issue_failed',
  Cancelled = 'cancelled',
}

export const PURCHASE_STATUSES = Object.values(PurchaseStatus)

export enum EsimPaymentMethod {
  Payme = 'payme',
  Click = 'click',
  Card = 'card',
}

export const ESIM_PAYMENT_METHODS = Object.values(EsimPaymentMethod)

export const DEFAULT_MARGIN_PERCENT = 35

export const PAYMENT_WINDOW_MS = 12 * 60 * 60 * 1000

export const ESIM_LOCALES = ['ru', 'uz', 'en']

export const marginPercent = (): number => {
  const value = Number(process.env.ESIM_MARGIN_PERCENT)

  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_MARGIN_PERCENT
}

export function retailUzs(wholesaleUsd: number, usdRate: number, margin: number): number {
  if (!(wholesaleUsd > 0) || !(usdRate > 0)) throw new Error('A retail price needs a wholesale price and a rate')

  return Math.ceil(wholesaleUsd * (1 + margin / 100) * usdRate / 1000) * 1000
}

export interface ICheckoutInput {
  plan_id?: string
  email?: string
  phone?: string
  method?: string
  locale?: string
}

export interface ICheckout {
  planId: string
  email: string
  phone: string
  method: EsimPaymentMethod
  locale: string
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function checkoutOf(input: ICheckoutInput): ICheckout {
  const planId = typeof input.plan_id === 'string' ? input.plan_id.trim() : ''
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const phone = typeof input.phone === 'string' ? input.phone.replace(/[^\d+]/g, '') : ''
  const method = input.method as EsimPaymentMethod

  if (!planId) throw new BadRequestException('Choose a tariff')
  if (!EMAIL.test(email) || email.length > 160) throw new BadRequestException('Enter a valid email')
  if (!/^\+\d{9,15}$/.test(phone)) throw new BadRequestException('Enter the phone with the country code')
  if (!ESIM_PAYMENT_METHODS.includes(method)) throw new BadRequestException('Choose a payment method')

  return {
    planId,
    email,
    phone,
    method,
    locale: ESIM_LOCALES.includes(String(input.locale)) ? String(input.locale) : 'ru',
  }
}

export const newToken = (): string => randomBytes(18).toString('base64url')

export const maskEmail = (email: string): string => {
  const [name = '', domain = ''] = email.split('@')

  return `${name.slice(0, 2)}${'•'.repeat(Math.max(1, name.length - 2))}@${domain}`
}

export function expired(status: string, createdAt: Date, now = Date.now()): boolean {
  return status === PurchaseStatus.AwaitingPayment && now - createdAt.getTime() > PAYMENT_WINDOW_MS
}
