export const SESSION_PREFIX = 'session:token:'

export function sessionKey(token: string): string {
  return `${SESSION_PREFIX}${token}`
}

export function eventsMonthPrefix(userId: string): string {
  return `events:${userId}:`
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
