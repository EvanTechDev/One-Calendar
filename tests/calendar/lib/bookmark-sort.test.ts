import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BOOKMARK_SORT,
  normalizeBookmarkSort,
  sortBookmarks,
  type SortableBookmark,
} from '@/lib/bookmark-sort'

const bm = (
  id: string,
  title: string,
  startDate: string,
  bookmarkedAt: string,
): SortableBookmark => ({ id, title, startDate, bookmarkedAt })

const SAMPLE: SortableBookmark[] = [
  bm('1', 'Standup', '2026-03-01T09:00:00Z', '2026-01-05T00:00:00Z'),
  bm('2', 'all hands', '2026-03-10T09:00:00Z', '2026-03-02T00:00:00Z'),
  bm('3', 'Budget review', '2026-02-01T09:00:00Z', '2026-02-02T00:00:00Z'),
]

const ids = (list: SortableBookmark[]) => list.map((b) => b.id)

describe('normalizeBookmarkSort', () => {
  it('passes through a known sort', () => {
    expect(normalizeBookmarkSort('title-asc')).toBe('title-asc')
  })

  it('falls back on null, junk and a sort this build dropped', () => {
    // localStorage survives deploys, so the value read back can name a sort
    // that no longer exists. Rendering an empty list is the worse failure.
    expect(normalizeBookmarkSort(null)).toBe(DEFAULT_BOOKMARK_SORT)
    expect(normalizeBookmarkSort('by-vibes')).toBe(DEFAULT_BOOKMARK_SORT)
    expect(normalizeBookmarkSort(7)).toBe(DEFAULT_BOOKMARK_SORT)
  })
})

describe('sortBookmarks', () => {
  it('orders by title ascending, case-insensitively', () => {
    expect(ids(sortBookmarks(SAMPLE, 'title-asc'))).toEqual(['2', '3', '1'])
  })

  it('orders by title descending, case-insensitively', () => {
    expect(ids(sortBookmarks(SAMPLE, 'title-desc'))).toEqual(['1', '3', '2'])
  })

  it('orders by start date, not by title', () => {
    expect(ids(sortBookmarks(SAMPLE, 'date-desc'))).toEqual(['2', '1', '3'])
    expect(ids(sortBookmarks(SAMPLE, 'date-asc'))).toEqual(['3', '1', '2'])
  })

  it('orders by when the bookmark was made', () => {
    expect(ids(sortBookmarks(SAMPLE, 'bookmarked-desc'))).toEqual([
      '2',
      '3',
      '1',
    ])
    expect(ids(sortBookmarks(SAMPLE, 'bookmarked-asc'))).toEqual([
      '1',
      '3',
      '2',
    ])
  })

  it('reverses exactly — each ascending sort is its descending mirror', () => {
    // The two are separate menu entries, so a direction that quietly fails to
    // invert would leave a pair of options that order identically.
    for (const [asc, desc] of [
      ['title-asc', 'title-desc'],
      ['date-asc', 'date-desc'],
      ['bookmarked-asc', 'bookmarked-desc'],
    ] as const) {
      const up = ids(sortBookmarks(SAMPLE, asc))
      const down = ids(sortBookmarks(SAMPLE, desc))
      expect(down).toEqual([...up].reverse())
    }
  })

  it('does not mutate the caller list', () => {
    const list = [...SAMPLE]
    sortBookmarks(list, 'title-desc')
    expect(ids(list)).toEqual(['1', '2', '3'])
  })

  it('breaks ties on id, so equal keys have one stable order', () => {
    const tied = [
      bm('b', 'Same', '2026-03-01T09:00:00Z', '2026-01-01T00:00:00Z'),
      bm('a', 'Same', '2026-03-01T09:00:00Z', '2026-01-01T00:00:00Z'),
    ]
    // Every key is equal, so without the tiebreak the output is whatever the
    // engine's stable sort happened to preserve — i.e. the server's order.
    expect(ids(sortBookmarks(tied, 'date-desc'))).toEqual(['a', 'b'])
    expect(ids(sortBookmarks(tied, 'title-asc'))).toEqual(['a', 'b'])
  })

  it('sorts numerals inside titles naturally', () => {
    const numbered = [
      bm('x', 'Sync 10', '2026-03-01T09:00:00Z', '2026-01-01T00:00:00Z'),
      bm('y', 'Sync 2', '2026-03-01T09:00:00Z', '2026-01-01T00:00:00Z'),
    ]
    // Codepoint order would put "Sync 10" before "Sync 2".
    expect(ids(sortBookmarks(numbered, 'title-asc'))).toEqual(['y', 'x'])
  })

  it('pins unparseable stamps to the end, in BOTH directions', () => {
    // A bookmark whose event is not in the loaded event list joins with
    // startDate: ''. `new Date('')` is NaN, and NaN compares false against
    // everything, so without a rule its row would compare EQUAL to all others
    // and land wherever the sort left it — different place per sort, and
    // different again depending on which ran last.
    const withGap = [
      bm('ok', 'Has a date', '2026-03-01T09:00:00Z', '2026-01-01T00:00:00Z'),
      bm('gap', 'No date', '', '2026-01-01T00:00:00Z'),
    ]
    expect(ids(sortBookmarks(withGap, 'date-desc'))).toEqual(['ok', 'gap'])
    expect(ids(sortBookmarks(withGap, 'date-asc'))).toEqual(['ok', 'gap'])
  })

  it('handles every sort in BOOKMARK_SORTS without throwing', () => {
    const gap = [bm('gap', 'No date', '', 'not-a-date'), ...SAMPLE]
    for (const sort of [
      'title-asc',
      'title-desc',
      'date-desc',
      'date-asc',
      'bookmarked-desc',
      'bookmarked-asc',
    ] as const) {
      expect(sortBookmarks(gap, sort)).toHaveLength(gap.length)
    }
  })

  it('accepts Date as well as string stamps', () => {
    const mixed: SortableBookmark[] = [
      { ...SAMPLE[0], startDate: new Date('2026-03-01T09:00:00Z') },
      { ...SAMPLE[2], startDate: new Date('2026-02-01T09:00:00Z') },
    ]
    expect(ids(sortBookmarks(mixed, 'date-desc'))).toEqual(['1', '3'])
  })
})
