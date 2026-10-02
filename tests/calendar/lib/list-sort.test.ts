import { describe, expect, it } from 'vitest'
import { applyListSort, LIST_SORTS } from '@/lib/list-sort'
import {
  DEFAULT_BOOKMARK_SORT,
  sortBookmarks,
  type SortableBookmark,
} from '@/lib/bookmark-sort'
import {
  DEFAULT_COUNTDOWN_SORT,
  sortCountdowns,
  type SortableCountdown,
} from '@/lib/countdown-sort'

const bookmark = (
  over: Partial<SortableBookmark> & { id: string },
): SortableBookmark => ({
  title: 'Untitled',
  startDate: '',
  bookmarkedAt: '2026-01-01T00:00:00.000Z',
  ...over,
})

const ids = (rows: readonly { id: string }[]) => rows.map((r) => r.id)

describe('applyListSort', () => {
  const fields = {
    title: (b: SortableBookmark) => b.title,
    date: (b: SortableBookmark) => b.startDate,
    created: (b: SortableBookmark) => b.bookmarkedAt,
    id: (b: SortableBookmark) => b.id,
  }

  it("does not sort the caller's array in place", () => {
    const rows = [
      bookmark({ id: 'b', title: 'Zeta' }),
      bookmark({ id: 'a', title: 'Alpha' }),
    ]
    const sorted = applyListSort(rows, 'title-asc', fields)
    expect(ids(rows)).toEqual(['b', 'a'])
    expect(ids(sorted)).toEqual(['a', 'b'])
  })

  it('orders title ascending and descending', () => {
    const rows = [
      bookmark({ id: '1', title: 'Beta' }),
      bookmark({ id: '2', title: 'alpha' }),
      bookmark({ id: '3', title: 'Gamma' }),
    ]
    expect(ids(applyListSort(rows, 'title-asc', fields))).toEqual([
      '2',
      '1',
      '3',
    ])
    expect(ids(applyListSort(rows, 'title-desc', fields))).toEqual([
      '3',
      '1',
      '2',
    ])
  })

  it('folds case so "alpha" and "Alpha" do not split', () => {
    const rows = [
      bookmark({ id: '1', title: 'zeta' }),
      bookmark({ id: '2', title: 'Alpha' }),
    ]
    expect(ids(applyListSort(rows, 'title-asc', fields))).toEqual(['2', '1'])
  })

  it('orders titles numerically, so "Sync 2" precedes "Sync 10"', () => {
    const rows = [
      bookmark({ id: '10', title: 'Sync 10' }),
      bookmark({ id: '2', title: 'Sync 2' }),
    ]
    expect(ids(applyListSort(rows, 'title-asc', fields))).toEqual(['2', '10'])
  })

  it('orders by date in both directions', () => {
    const rows = [
      bookmark({ id: 'mid', startDate: '2026-06-15' }),
      bookmark({ id: 'late', startDate: '2026-12-31' }),
      bookmark({ id: 'early', startDate: '2026-01-01' }),
    ]
    expect(ids(applyListSort(rows, 'date-asc', fields))).toEqual([
      'early',
      'mid',
      'late',
    ])
    expect(ids(applyListSort(rows, 'date-desc', fields))).toEqual([
      'late',
      'mid',
      'early',
    ])
  })

  it('pins an unparseable date to the END in both directions', () => {
    // `new Date('')` is NaN, and NaN compares false against everything — a row
    // that compared EQUAL to all would land wherever the engine happened to
    // stop, so ascending and descending would disagree about where it goes.
    const rows = [
      bookmark({ id: 'broken', startDate: '' }),
      bookmark({ id: 'early', startDate: '2026-01-01' }),
      bookmark({ id: 'late', startDate: '2026-12-31' }),
    ]
    expect(ids(applyListSort(rows, 'date-asc', fields))).toEqual([
      'early',
      'late',
      'broken',
    ])
    expect(ids(applyListSort(rows, 'date-desc', fields))).toEqual([
      'late',
      'early',
      'broken',
    ])
  })

  it('treats a missing created stamp as unparseable', () => {
    const rows = [
      bookmark({ id: 'newer', bookmarkedAt: '2026-02-01T00:00:00.000Z' }),
      bookmark({ id: 'older', bookmarkedAt: '2026-01-01T00:00:00.000Z' }),
    ]
    const noStamp = [{ ...rows[0], id: 'none', bookmarkedAt: '' }]
    expect(
      ids(applyListSort([rows[0], noStamp[0]], 'created-desc', fields)),
    ).toEqual(['newer', 'none'])
  })

  it('breaks ties on id, so equal keys have one order', () => {
    const rows = [
      bookmark({ id: 'c', title: 'Same' }),
      bookmark({ id: 'a', title: 'Same' }),
      bookmark({ id: 'b', title: 'Same' }),
    ]
    expect(ids(applyListSort(rows, 'title-asc', fields))).toEqual([
      'a',
      'b',
      'c',
    ])
    expect(ids(applyListSort(rows, 'title-desc', fields))).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('every declared sort is a total order over a mixed list', () => {
    const rows = [
      bookmark({
        id: '1',
        title: 'b',
        startDate: '',
        bookmarkedAt: '2026-03-01',
      }),
      bookmark({ id: '2', title: 'a', startDate: '2026-01-01' }),
      bookmark({
        id: '3',
        title: 'b',
        startDate: '2026-02-01',
        bookmarkedAt: '',
      }),
    ]
    // The point is not the permutation but that no sort throws and none leaves
    // a row behind — `applyListSort` copies, so length must be preserved.
    for (const sort of LIST_SORTS) {
      expect(applyListSort(rows, sort, fields)).toHaveLength(rows.length)
    }
  })
})

describe('sortBookmarks', () => {
  it('defaults to newest bookmark first, which is what the server sends', () => {
    expect(DEFAULT_BOOKMARK_SORT).toBe('created-desc')
  })

  it('reads created_at as the "bookmarked" stamp, not the event start', () => {
    const rows = [
      bookmark({
        id: 'old',
        startDate: '2030-01-01',
        bookmarkedAt: '2026-01-01',
      }),
      bookmark({
        id: 'new',
        startDate: '2020-01-01',
        bookmarkedAt: '2026-06-01',
      }),
    ]
    expect(ids(sortBookmarks(rows, DEFAULT_BOOKMARK_SORT))).toEqual([
      'new',
      'old',
    ])
  })

  it('keeps extra row fields on the returned rows', () => {
    const rows = [{ ...bookmark({ id: 'a', title: 'Zeta' }), eventId: 'e1' }]
    expect(sortBookmarks(rows, 'title-asc')[0].eventId).toBe('e1')
  })
})

describe('sortCountdowns', () => {
  const countdown = (
    over: Partial<SortableCountdown> & { id: string },
  ): SortableCountdown => ({
    name: 'Untitled',
    date: '2026-01-01',
    ...over,
  })

  it('defaults to soonest first — the panel had no server order to keep', () => {
    expect(DEFAULT_COUNTDOWN_SORT).toBe('date-asc')
  })

  it('puts the nearest deadline first by default', () => {
    const rows = [
      countdown({ id: 'far', name: 'Graduation', date: '2030-06-01' }),
      countdown({ id: 'near', name: 'Tax deadline', date: '2026-09-30' }),
    ]
    expect(ids(sortCountdowns(rows, DEFAULT_COUNTDOWN_SORT))).toEqual([
      'near',
      'far',
    ])
  })

  it('sorts by name in both directions', () => {
    const rows = [
      countdown({ id: '1', name: 'tax', date: '2026-03-01' }),
      countdown({ id: '2', name: 'Anniversary', date: '2026-02-01' }),
    ]
    // Case-folded, like every other name sort here: A before t.
    expect(ids(sortCountdowns(rows, 'title-asc'))).toEqual(['2', '1'])
    expect(ids(sortCountdowns(rows, 'title-desc'))).toEqual(['1', '2'])
  })

  it('sorts by the created stamp the panel only sometimes has', () => {
    const rows = [
      countdown({ id: 'old', createdAt: '2026-01-01T00:00:00.000Z' }),
      countdown({ id: 'new', createdAt: '2026-06-01T00:00:00.000Z' }),
      // A row the panel saved locally, before the server stamped one.
      countdown({ id: 'pending' }),
    ]
    expect(ids(sortCountdowns(rows, 'created-desc'))).toEqual([
      'new',
      'old',
      'pending',
    ])
    expect(ids(sortCountdowns(rows, 'created-asc'))).toEqual([
      'old',
      'new',
      'pending',
    ])
  })

  it('does not reorder the array the panel holds in state', () => {
    const rows = [
      countdown({ id: 'far', date: '2030-01-01' }),
      countdown({ id: 'near', date: '2026-01-01' }),
    ]
    const sorted = sortCountdowns(rows, 'date-asc')
    expect(ids(rows)).toEqual(['far', 'near'])
    expect(ids(sorted)).toEqual(['near', 'far'])
  })
})
