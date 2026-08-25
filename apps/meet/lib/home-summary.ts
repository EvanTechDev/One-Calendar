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
