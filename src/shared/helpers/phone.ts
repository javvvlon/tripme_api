/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export function phoneKey(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '')

  if (digits.length === 9) return `998${digits}`

  return digits.length >= 9 ? digits : ''
}
