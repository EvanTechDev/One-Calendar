/**
 * Bookmark panel's binding to the shared list-sort rules.
 *
 * The rules themselves are in `lib/list-sort.ts`; this module is only the
 * mapping from a bookmark row onto the three fields those rules sort on.
 */

import {
  applyListSort,
  type ListSort,
  type ListSortFields,
} from '#calendar/lib/list-sort'

export type { ListSort as BookmarkSort }

export const BOOKMARK_SORT_STORAGE_KEY = 'bookmark-sort'

/**
 * Newest bookmark first — which IS the order the server sends
 * (`orderBy(desc(bookmarkedEvents.createdAt))`), so a first-time visit does not
 * reshuffle an untouched list.
 */
export const DEFAULT_BOOKMARK_SORT: ListSort = 'created-desc'

export interface SortableBookmark {
  id: string
  title: string
  /** `''` when the bookmark's event is not in the loaded event list. */
  startDate: string | Date
  /** `bookmarked_events.created_at` — there is no updated_at on that table. */
  bookmarkedAt: string
}

const BOOKMARK_FIELDS: ListSortFields<SortableBookmark> = {
  title: (b) => b.title,
  date: (b) => b.startDate,
  // A bookmark's created_at IS its "last changed" time: there is no
  // updated_at, and re-bookmarking an event is an upsert that conflicts on
  // (user_id, event_id) and keeps the original row.
  created: (b) => b.bookmarkedAt,
  id: (b) => b.id,
}

export function sortBookmarks<T extends SortableBookmark>(
  bookmarks: readonly T[],
  sort: ListSort,
): T[] {
  return applyListSort(bookmarks, sort, BOOKMARK_FIELDS)
}
