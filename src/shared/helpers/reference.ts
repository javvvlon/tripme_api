/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const LEAD_PREFIX = 'LD'
export const ORDER_PREFIX = 'ORD'

export function reference(prefix: string, number: number | string, at: Date | string): string {
  const year = new Date(at).getUTCFullYear()

  return `${prefix}-${year}-${String(number).padStart(4, '0')}`
}

export function numberFromReference(needle: string, prefix: string): number | null {
  const match = new RegExp(`^${prefix}-\\d{4}-0*(\\d+)$`, 'i').exec(needle.trim())

  return match ? Number(match[1]) : null
}
