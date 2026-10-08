/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const siteUrl = (): string => (process.env.SITE_URL || 'http://localhost:3000').replace(/\/+$/, '')

export const orderUrl = (locale: string, token: string): string => `${siteUrl()}/${locale}/esim/order/${token}`

export const esimSandbox = (): boolean => process.env.ESIM_SANDBOX === '1'
