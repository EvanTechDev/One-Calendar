/**
 * The pure decisions behind the dashboard's home section, kept out of the
 * component for the same reason as lib/video-layout.ts: they are the parts
 * worth asserting on, and neither needs a DOM to be true.
 */

export type Greeting =
  | 'Good morning'
  | 'Good afternoon'
  | 'Good evening'
  | 'Good night'

/**
 * Time-of-day greeting in the VISITOR's local time. Bands follow the same
 * convention as the calendar's day view (night rolls over at 05:00 rather than
 * midnight, so an 02:00 user is not told "good morning").
 */
export function greetingFor(now: Date): Greeting {
  const hour = now.getHours()
  if (hour < 5) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** "Ada" from "Ada Lovelace"; empty when there is nothing usable. */
export function firstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? ''
}

export interface DatedRow {
  startDate: string
  endDate: string
}

/** Relative scheduled time, not a claim that anyone is connected to the room. */
export function meetingTiming(row: DatedRow, now: Date): string {
  const start = Date.parse(row.startDate)
  const end = Date.parse(row.endDate)
  const current = now.getTime()
  if (current >= end) return 'Scheduled time ended'
  if (current >= start) return 'Scheduled now'

  const minutes = Math.ceil((start - current) / 60_000)
  if (minutes < 60) return `Starts in ${minutes} min`
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60)
    const remainder = minutes % 60
    return `Starts in ${hours} hr${remainder ? ` ${remainder} min` : ''}`
  }
  const days = Math.ceil(minutes / 1440)
  return `Starts in ${days} ${days === 1 ? 'day' : 'days'}`
}

/**
 * The one meeting worth putting on home: the earliest that has not finished
 * yet. A meeting already under way outranks one starting later — that is the
 * one the user is late for.
 *
 * Rows are re-sorted rather than trusted in order: the list is fetched from
 * the calendar app, and home showing the wrong "next" meeting is a wrong join
 * time, which is the same class of bug the timezone fix in
 * upcoming-meetings.tsx already addressed.
 */
export function nextUpcoming<T extends DatedRow>(
  rows: T[],
  now: Date,
): T | null {
  const live = rows
    .filter((row) => {
      const end = Date.parse(row.endDate)
      return Number.isFinite(end) && end > now.getTime()
    })
    .sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate))
  return live[0] ?? null
}
