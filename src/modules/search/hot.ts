/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const DEFAULT_HOT_DAYS = 5

export const LEAD_HOURS = 18

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function hotDays(): number {
  const n = Number(process.env.HOT_DAYS)

  return Number.isInteger(n) && n > 0 && n <= 60 ? n : DEFAULT_HOT_DAYS
}

export const tashkentToday = (now = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)

export const daysUntil = (day: string, today: string): number =>
  Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)

export function isHotDeparture(checkIn: string, stopped: boolean, today: string, days = hotDays()): boolean {
  if (stopped || !ISO_DATE.test(checkIn) || !ISO_DATE.test(today)) return false

  const left = daysUntil(checkIn, today)

  return left >= 1 && left <= days
}

export function earliestDeparture(now = new Date()): string {
  const tomorrow = tashkentToday(new Date(now.getTime() + 24 * 60 * 60 * 1000))
  const lead = tashkentToday(new Date(now.getTime() + LEAD_HOURS * 60 * 60 * 1000))

  return lead > tomorrow ? lead : tomorrow
}
