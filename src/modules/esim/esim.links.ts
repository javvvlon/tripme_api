/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const siteUrl = (): string => (process.env.SITE_URL || 'http://localhost:3000').replace(/\/+$/, '')

export const orderUrl = (locale: string, token: string): string => `${siteUrl()}/${locale}/esim/order/${token}`

export const esimSandbox = (): boolean => process.env.ESIM_SANDBOX === '1'

export interface IEsimAffiliate {
  partner: string
  url: string
  code: string
  discount_percent: number
}

export const ESIMO_REFERRAL_URL = 'https://esimo.sng.link/Dfwtk/8ix7/gg0w'

export const ESIMO_PROMO_CODE = 'TRIPME'

export const ESIMO_DISCOUNT_PERCENT = 20

export function esimoAffiliate(): IEsimAffiliate {
  const discount = Number(process.env.ESIMO_DISCOUNT_PERCENT)

  return {
    partner: 'eSIMo',
    url: process.env.ESIMO_REFERRAL_URL?.trim() || ESIMO_REFERRAL_URL,
    code: process.env.ESIMO_PROMO_CODE?.trim() || ESIMO_PROMO_CODE,
    discount_percent: Number.isFinite(discount) && discount >= 0 ? discount : ESIMO_DISCOUNT_PERCENT,
  }
}
