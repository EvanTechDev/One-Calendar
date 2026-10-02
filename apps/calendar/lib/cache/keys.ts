import { createHash } from 'crypto'

export const SESSION_PREFIX = 'session:token:'

export function sessionKey(token: string): string {
  const digest = createHash('sha256').update(token).digest('hex')
  return `${SESSION_PREFIX}${digest}`
}

export function eventsMonthKey(userId: string, yearMonth: string): string {
  return `events:${userId}:${yearMonth}`
}

export function yearMonthFromDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function affectedMonths(startDate: string, endDate: string): string[] {
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return []

  // Walk the year/month pair, not the Date. `cursor.setUTCMonth(m + 1)`
  // overflows and normalises forward: from 31 January it lands on 3 March,
  // skipping February entirely, and from 31 March it skips April. A write in
  // January then never cleared February's cache, so everything written in that
  // window stayed invisible until the entry expired on its own.
  const months: string[] = []
  let year = start.getUTCFullYear()
  let month = start.getUTCMonth()
  const endYear = end.getUTCFullYear()
  const endMonth = end.getUTCMonth()

  for (;;) {
    months.push(`${year}-${String(month + 1).padStart(2, '0')}`)
    if (year === endYear && month === endMonth) break
    month += 1
    if (month > 11) {
      month = 0
      year += 1
    }
  }

  return months
}

function monthBounds(yearMonth: string): { start: Date; end: Date } {
  const [year, month] = yearMonth.split('-').map(Number)
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
  }
}

export function fullMonthRange(
  startDate: string,
  endDate: string,
): { start: Date; end: Date } {
  const months = affectedMonths(startDate, endDate)
  const first = monthBounds(months[0]!).start
  const last = monthBounds(months[months.length - 1]!).end
  return { start: first, end: last }
}
