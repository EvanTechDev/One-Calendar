/**


 * Ordering for the sidebar's small lists — bookmarks, countdowns.
 *
 * Both panels are "a search box, a sort button, a list" over records that
 * differ only in what they call their fields (an event has a `title` and a
 * `startDate`; a countdown has a `name` and a `targetDate`). The RULES, though,
 * are identical, and the first copy of them was already written twice in two
 * files before this module existed — so they live here once, with each panel
 * supplying only the accessors that map its own record onto the shared shape.
 *
 * Pure and free of React, so each rule can be stated once and tested directly.
 */

export const LIST_SORTS = [
  'title-asc',
  'title-desc',
  'date-desc',
  'date-asc',
  'created-desc',
  'created-asc',
] as const

export type ListSort = (typeof LIST_SORTS)[number]

/**
 * Guards a value read back out of storage, which is untrusted: a hand-edited
 * key, or a sort written by a build that had an option this one dropped.
 */
export function isListSort(value: unknown): value is ListSort {
  return (
    typeof value === 'string' &&
    (LIST_SORTS as readonly string[]).includes(value)
  )
}

/**
 * How a record presents the three fields the rules sort on. `title` and `date`
 * are what the user sees on the row; `created` is when the record was made,
 * which is the only "when did this change" a panel can offer without a
 * per-record edit timestamp on the wire.
 */
export interface ListSortFields<T> {
  title: (item: T) => string
  /** `''` or an unparseable value pins the row to the end — see `byTime`. */
  date: (item: T) => string | Date | undefined
  created: (item: T) => string | Date | undefined
  /** Stable tiebreak, so equal keys have one order rather than the engine's. */
  id: (item: T) => string
}

/**
 * `NaN` compares false against everything, so an unparseable stamp would make
 * its row compare EQUAL to every other row and land wherever the engine
 * happened to leave it — the order would then depend on which sort ran last.
 * Pin unparseable rows to the end regardless of direction.
 */
function byTime(a: number, b: number, direction: 1 | -1): number {
  const aBad = Number.isNaN(a)
  const bBad = Number.isNaN(b)
  if (aBad && bBad) return 0
  if (aBad) return 1
  if (bBad) return -1
  return (a - b) * direction
}

/**
 * `sensitivity: 'base'` folds case so "standup" and "Standup" sort together
 * instead of splitting; `numeric` orders "Sync 2" before "Sync 10". The locale
 * is left to the runtime — the panels already render through `Intl`, and
 * pinning one here is how the countdown date formatting ended up English
 * underneath 33 translated locales.
 */
function byTitle(a: string, b: string, direction: 1 | -1): number {
  return (
    a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }) *
    direction
  )
}

function toTime(value: string | Date | undefined | null): number {
  if (value === undefined || value === null || value === '') return Number.NaN
  return new Date(value).getTime()
}

/**
 * Returns a new sorted array — the caller's list is component state, and
 * sorting it in place would make the panel's own re-render read a reordered
 * list it never asked for.
 */
export function applyListSort<T>(
  items: readonly T[],
  sort: ListSort,
  fields: ListSortFields<T>,
): T[] {
  const direction: 1 | -1 = sort.endsWith('-asc') ? 1 : -1

  return [...items].sort((a, b) => {
    const primary = ((): number => {
      switch (sort) {
        case 'title-asc':
        case 'title-desc':
          return byTitle(fields.title(a), fields.title(b), direction)
        case 'date-asc':
        case 'date-desc':
          return byTime(
            toTime(fields.date(a)),
            toTime(fields.date(b)),
            direction,
          )
        case 'created-asc':
        case 'created-desc':
          return byTime(
            toTime(fields.created(a)),
            toTime(fields.created(b)),
            direction,
          )
      }
    })()

    if (primary !== 0) return primary
    const [aId, bId] = [fields.id(a), fields.id(b)]
    return aId < bId ? -1 : aId > bId ? 1 : 0
  })
}
