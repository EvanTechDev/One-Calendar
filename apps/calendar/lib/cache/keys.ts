export const SESSION_PREFIX = 'session:token:'

export function sessionKey(token: string): string {
  return `${SESSION_PREFIX}${token}`
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
  const months = new Set<string>()

  const cursor = new Date(start)
  while (cursor <= end) {
    months.add(yearMonthFromDate(cursor))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }

  return Array.from(months)
}

export function monthBounds(yearMonth: string): { start: Date; end: Date } {
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
