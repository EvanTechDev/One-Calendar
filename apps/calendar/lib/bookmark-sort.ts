/**
 * Ordering for the bookmark panel's list.
 *
 * Pure and free of React so the rules can be stated once and tested directly:
 * the panel used to render whatever order `/api/bookmarks` returned (newest
 * bookmark first) with no way to change it, so a user with many bookmarks had
 * to read the list to find one.
 *
 * The default is `bookmarked-desc` because that IS the order the server sends
 * (`orderBy(desc(bookmarkedEvents.createdAt))`). Persisting a different choice
 * must therefore not silently reshuffle an untouched list on first paint.
 */

export const BOOKMARK_SORT_STORAGE_KEY = 'bookmark-sort'

export const BOOKMARK_SORTS = [
  'title-asc',
  'title-desc',
  'date-desc',
  'date-asc',
  'bookmarked-desc',
  'bookmarked-asc',
] as const

export type BookmarkSort = (typeof BOOKMARK_SORTS)[number]

export const DEFAULT_BOOKMARK_SORT: BookmarkSort = 'bookmarked-desc'

export interface SortableBookmark {
  id: string
  title: string
  /** `''` when the bookmark's event is not in the loaded event list. */
  startDate: string | Date
  /** `bookmarked_events.created_at` — there is no updated_at on that table. */
  bookmarkedAt: string
}

export function isBookmarkSort(value: unknown): value is BookmarkSort {
  return (
    typeof value === 'string' &&
    (BOOKMARK_SORTS as readonly string[]).includes(value)
  )
}

/**
 * Anything read back from storage is untrusted: a hand-edited key, or a value
 * written by a build that had a sort this one dropped. Falling back to the
 * default beats rendering an empty list.
 */
export function normalizeBookmarkSort(value: unknown): BookmarkSort {
  return isBookmarkSort(value) ? value : DEFAULT_BOOKMARK_SORT
}

/**
 * `NaN` compares false against everything, so an unparseable stamp would make
 * its row compare EQUAL to every other row and land wherever the engine
 * happened to leave it — the order would then depend on which sort ran last.
 * Pin unparseable rows to the end instead, in both directions.
 */
function compareTimes(a: number, b: number, direction: 1 | -1): number {
  const aBad = Number.isNaN(a)
  const bBad = Number.isNaN(b)
  if (aBad && bBad) return 0
  if (aBad) return 1
  if (bBad) return -1
  return (a - b) * direction
}

function compareTitles(a: string, b: string, direction: 1 | -1): number {
  // `sensitivity: 'base'` folds case so "standup" and "Standup" sort together
  // instead of splitting; `numeric` orders "Sync 2" before "Sync 10". The
  // locale is left to the runtime — the panel already renders through
  // `Intl`, and pinning one here is how the countdown date formatting ended up
  // English underneath 33 translated locales.
  return (
    a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }) *
    direction
  )
}

const toTime = (value: string | Date | undefined): number => {
  if (value === undefined || value === null || value === '') return Number.NaN
  return new Date(value).getTime()
}

/**
 * Returns a new sorted array — the caller's list is state, and sorting it in
 * place would make the next sort a no-op on an already-reordered list only by
 * luck of stability, not by intent.
 *
 * `id` breaks every tie, so equal titles or equal stamps have one stable order
 * rather than inheriting whatever order the server happened to send.
 */
export function sortBookmarks<T extends SortableBookmark>(
  bookmarks: readonly T[],
  sort: BookmarkSort,
): T[] {
  const direction: 1 | -1 = sort.endsWith('-asc') ? 1 : -1

  return [...bookmarks].sort((a, b) => {
    const bySort = ((): number => {
      switch (sort) {
        case 'title-asc':
        case 'title-desc':
          return compareTitles(a.title, b.title, direction)
        case 'date-asc':
        case 'date-desc':
          return compareTimes(
            toTime(a.startDate),
            toTime(b.startDate),
            direction,
          )
        case 'bookmarked-asc':
        case 'bookmarked-desc':
          return compareTimes(
            toTime(a.bookmarkedAt),
            toTime(b.bookmarkedAt),
            direction,
          )
      }
    })()

    if (bySort !== 0) return bySort
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}
