/**
 * Pins firstVisibleStampOfSeries and the isFirstInstance marker in
 * expandSeriesView. The product rule (plan 004) is that "all events" edits
 * are only offered on a series' first VISIBLE occurrence — the first
 * generated instance not removed by an exdate — so both the helper and the
 * marker must skip exdated firsts.
 */
import { describe, it, expect } from 'vitest'
import {
  expandSeriesView,
  firstVisibleStampOfSeries,
  type SeriesViewInput,
} from '@/lib/recurrence/engine'

function day(y: number, m: number, d: number, h = 0, min = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, h, min, 0))
}

function makeSeries(overrides: Partial<SeriesViewInput> = {}): SeriesViewInput {
  return {
    id: 'm1',
    title: 'Standup',
    startDate: day(2026, 8, 3, 9), // Monday
    endDate: day(2026, 8, 3, 10),
    isAllDay: false,
    rrule: 'FREQ=WEEKLY;BYDAY=MO',
    exdate: null,
    seriesId: null,
    recurrenceId: null,
    color: null,
    ...overrides,
  }
}

describe('firstVisibleStampOfSeries', () => {
  it('returns the master start stamp when nothing is exdated', () => {
    expect(firstVisibleStampOfSeries(makeSeries(), 'UTC')).toBe(
      '20260803T090000Z',
    )
  })

  it('returns the date-only stamp for all-day series', () => {
    const series = makeSeries({
      isAllDay: true,
      startDate: day(2026, 8, 3),
      endDate: day(2026, 8, 4),
    })
    expect(firstVisibleStampOfSeries(series, 'UTC')).toBe('20260803')
  })

  it('skips an exdated first occurrence and returns the second', () => {
    const series = makeSeries({ exdate: ['20260803T090000Z'] })
    expect(firstVisibleStampOfSeries(series, 'UTC')).toBe('20260810T090000Z')
  })

  it('handles a yearly series with the first two years exdated (5-year bound)', () => {
    const series = makeSeries({
      rrule: 'FREQ=YEARLY',
      exdate: ['20260803T090000Z', '20270803T090000Z'],
    })
    expect(firstVisibleStampOfSeries(series, 'UTC')).toBe('20280803T090000Z')
  })

  it('returns null for a rule-less event', () => {
    expect(firstVisibleStampOfSeries(makeSeries({ rrule: null }), 'UTC')).toBe(
      null,
    )
  })
})

describe('expandSeriesView isFirstInstance marker', () => {
  it('marks exactly one instance for a plain series', () => {
    const out = expandSeriesView(
      [makeSeries()],
      [],
      day(2026, 8, 1),
      day(2026, 9, 1),
      1000,
      'UTC',
    )
    const marked = out.filter((e) => e.isFirstInstance === true)
    expect(marked).toHaveLength(1)
    expect(marked[0].id).toBe('m1_20260803T090000Z')
  })

  it('moves the marker to the second occurrence when the first is exdated', () => {
    const out = expandSeriesView(
      [makeSeries({ exdate: ['20260803T090000Z'] })],
      [],
      day(2026, 8, 1),
      day(2026, 9, 1),
      1000,
      'UTC',
    )
    const marked = out.filter((e) => e.isFirstInstance === true)
    expect(marked).toHaveLength(1)
    expect(marked[0].id).toBe('m1_20260810T090000Z')
  })

  it('does not mark orphan overrides or non-recurring rows', () => {
    const orphan = {
      ...makeSeries(),
      id: 'o-orphan',
      rrule: null,
      seriesId: 'missing-master',
      recurrenceId: '20260803T090000Z',
    }
    const plain = makeSeries({ id: 'p1', rrule: null })
    const out = expandSeriesView(
      [plain, orphan],
      [],
      day(2026, 8, 1),
      day(2026, 9, 1),
      1000,
      'UTC',
    )
    expect(out.every((e) => e.isFirstInstance !== true)).toBe(true)
  })
})
