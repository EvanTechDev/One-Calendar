/**

 * Countdown panel's binding to the shared list-sort rules.
 *
 * The rules themselves are in `lib/list-sort.ts`; this module is only the
 * mapping from a countdown row onto the three fields those rules sort on.
 */

import {
  applyListSort,
  type ListSort,
  type ListSortFields,
} from '#calendar/lib/list-sort'

export type { ListSort as CountdownSort }

export const COUNTDOWN_SORT_STORAGE_KEY = 'countdown-sort'

/**
 * Soonest first. `/api/countdowns` sends rows in whatever order Postgres
 * returns them — there is no `orderBy` on that query — so the panel has no
 * server order to preserve, and a countdown list reads as a list of deadlines:
 * what is nearest is what the user opened it for.
 */
export const DEFAULT_COUNTDOWN_SORT: ListSort = 'date-asc'

/**
 * The panel's own row shape, not `CountdownData`: the panel already flattened
 * `targetDate` to a `yyyy-MM-dd` string and dropped everything it does not
 * render, and this module is the binding to that row.
 */
export interface SortableCountdown {
  id: string
  name: string
  /** `yyyy-MM-dd`, date only — a time of day would be noise on this panel. */
  date: string
  /** Absent on a row the panel built itself, before the server stamps one. */
  createdAt?: string
}

const COUNTDOWN_FIELDS: ListSortFields<SortableCountdown> = {
  title: (c) => c.name,
  date: (c) => c.date,
  created: (c) => c.createdAt,
  id: (c) => c.id,
}

export function sortCountdowns<T extends SortableCountdown>(
  countdowns: readonly T[],
  sort: ListSort,
): T[] {
  return applyListSort(countdowns, sort, COUNTDOWN_FIELDS)
}
