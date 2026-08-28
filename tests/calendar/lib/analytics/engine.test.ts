// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  compareSummaries,
  computeDistribution,
  computeInsights,
  computeSummary,
  dayKeyOf,
  filterByStart,
  hourOf,
  previousRange,
  resolveRelativeRange,
  weekdayOf,
  INSIGHT_THRESHOLDS,
  UNCATEGORIZED_ID,
  type AnalyticsEngineEvent,
  type AnalyticsRange,
} from '@/lib/analytics/engine'

let seq = 0
function event(
  overrides: Partial<AnalyticsEngineEvent> = {},
): AnalyticsEngineEvent {
  seq += 1
  return {
    id: `e${seq}`,
    start: new Date('2025-06-10T10:00:00Z'),
    end: new Date('2025-06-10T11:00:00Z'),
    categoryId: 'work',
    isAllDay: false,
    ...overrides,
  }
}

// A fixed 14-day range: June 1 00:00 UTC → June 15 00:00 UTC (exclusive-ish).
const range: AnalyticsRange = {
  start: new Date('2025-06-01T00:00:00Z'),
  end: new Date('2025-06-14T23:59:59.999Z'),
}

describe('date helpers', () => {
  it('dayKeyOf formats in the given timezone', () => {
    const date = new Date('2025-06-10T23:30:00Z')
    expect(dayKeyOf(date, 'UTC')).toBe('2025-06-10')
    expect(dayKeyOf(date, 'Asia/Shanghai')).toBe('2025-06-11')
  })

  it('weekdayOf is Monday-first', () => {
    // 2025-06-09 is a Monday.
    expect(weekdayOf(new Date('2025-06-09T12:00:00Z'), 'UTC')).toBe(0)
    // 2025-06-15 is a Sunday.
    expect(weekdayOf(new Date('2025-06-15T12:00:00Z'), 'UTC')).toBe(6)
  })

  it('hourOf respects timezone', () => {
    const date = new Date('2025-06-10T22:00:00Z')
    expect(hourOf(date, 'UTC')).toBe(22)
    expect(hourOf(date, 'Asia/Shanghai')).toBe(6)
  })

  it('resolveRelativeRange covers exactly N days', () => {
    const now = new Date('2025-06-10T15:00:00Z')
    const result = resolveRelativeRange(7, now, 'UTC')
    expect(result.start.toISOString()).toBe('2025-06-04T00:00:00.000Z')
    expect(result.end.getTime()).toBe(
      new Date('2025-06-11T00:00:00.000Z').getTime() - 1,
    )
  })

  it('previousRange mirrors the range length backwards', () => {
    const prev = previousRange(range)
    expect(prev.end.getTime()).toBe(range.start.getTime() - 1)
    expect(prev.end.getTime() - prev.start.getTime()).toBe(
      range.end.getTime() - range.start.getTime(),
    )
  })
})

describe('computeSummary', () => {
  it('returns zeros for an empty range', () => {
    const summary = computeSummary([], range, { timeZone: 'UTC' })
    expect(summary.totalEvents).toBe(0)
    expect(summary.scheduledHours).toBe(0)
    expect(summary.busyDays).toBe(0)
    expect(summary.byCategory).toEqual([])
  })

  it('aggregates counts, hours, busy days and categories', () => {
    const events = [
      event({
        start: new Date('2025-06-02T09:00:00Z'),
        end: new Date('2025-06-02T10:30:00Z'),
        categoryId: 'work',
      }),
      event({
        start: new Date('2025-06-02T14:00:00Z'),
        end: new Date('2025-06-02T15:00:00Z'),
        categoryId: 'work',
      }),
      event({
        start: new Date('2025-06-03T09:00:00Z'),
        end: new Date('2025-06-03T10:00:00Z'),
        categoryId: null,
      }),
      event({
        start: new Date('2025-06-04T00:00:00Z'),
        end: new Date('2025-06-05T00:00:00Z'),
        isAllDay: true,
        categoryId: 'life',
      }),
    ]
    const summary = computeSummary(events, range, { timeZone: 'UTC' })
    expect(summary.totalEvents).toBe(4)
    expect(summary.allDayEvents).toBe(1)
    expect(summary.scheduledHours).toBe(3.5)
    expect(summary.busyDays).toBe(3)
    expect(summary.totalDays).toBe(14)
    expect(summary.avgDurationMinutes).toBe(70)

    const work = summary.byCategory.find((c) => c.categoryId === 'work')
    expect(work?.count).toBe(2)
    expect(work?.hours).toBe(2.5)
    expect(work?.sharePct).toBe(50)
    const uncategorized = summary.byCategory.find(
      (c) => c.categoryId === UNCATEGORIZED_ID,
    )
    expect(uncategorized?.count).toBe(1)
  })

  it('ignores events outside the range', () => {
    const events = [
      event({ start: new Date('2025-05-20T10:00:00Z') }),
      event({ start: new Date('2025-07-01T10:00:00Z') }),
    ]
    expect(computeSummary(events, range).totalEvents).toBe(0)
  })

  it('caps pathological durations at 24 hours', () => {
    const events = [
      event({
        start: new Date('2025-06-02T09:00:00Z'),
        end: new Date('2026-06-02T09:00:00Z'),
      }),
    ]
    const summary = computeSummary(events, range, { timeZone: 'UTC' })
    expect(summary.scheduledHours).toBeLessThanOrEqual(24)
  })
})

describe('compareSummaries', () => {
  it('computes deltas and null changePct on zero baselines', () => {
    const current = computeSummary(
      [
        event({
          start: new Date('2025-06-02T09:00:00Z'),
          end: new Date('2025-06-02T10:00:00Z'),
        }),
        event({
          start: new Date('2025-06-03T09:00:00Z'),
          end: new Date('2025-06-03T10:00:00Z'),
        }),
      ],
      range,
      { timeZone: 'UTC' },
    )
    const previous = computeSummary([], previousRange(range), {
      timeZone: 'UTC',
    })
    const comparison = compareSummaries(current, previous)
    expect(comparison.totalEvents.current).toBe(2)
    expect(comparison.totalEvents.previous).toBe(0)
    expect(comparison.totalEvents.changePct).toBeNull()
  })

  it('computes percentage change against a non-zero baseline', () => {
    const mk = (count: number, offsetDays: number) =>
      Array.from({ length: count }, (_, i) =>
        event({
          start: new Date(Date.UTC(2025, 5, 2 + offsetDays, 9 + (i % 8), 0, 0)),
          end: new Date(Date.UTC(2025, 5, 2 + offsetDays, 10 + (i % 8), 0, 0)),
        }),
      )
    const prevRange = previousRange(range)
    const current = computeSummary(mk(6, 0), range, { timeZone: 'UTC' })
    const previous = computeSummary(mk(4, -14), prevRange, {
      timeZone: 'UTC',
    })
    const comparison = compareSummaries(current, previous)
    expect(comparison.totalEvents.changePct).toBe(50)
  })
})

describe('computeDistribution', () => {
  it('buckets weekday counts, hours and the punch card', () => {
    const events = [
      // Monday June 2, 09:00, 2h
      event({
        start: new Date('2025-06-02T09:00:00Z'),
        end: new Date('2025-06-02T11:00:00Z'),
      }),
      // Monday June 9, 09:00, 1h
      event({
        start: new Date('2025-06-09T09:00:00Z'),
        end: new Date('2025-06-09T10:00:00Z'),
      }),
      // All-day Wednesday June 4 — counts for weekday, not hours.
      event({
        start: new Date('2025-06-04T00:00:00Z'),
        end: new Date('2025-06-05T00:00:00Z'),
        isAllDay: true,
      }),
    ]
    const distribution = computeDistribution(events, range, {
      timeZone: 'UTC',
    })
    expect(distribution.byWeekday[0]).toEqual({
      weekday: 0,
      count: 2,
      hours: 3,
    })
    expect(distribution.byWeekday[2].count).toBe(1)
    expect(distribution.byWeekday[2].hours).toBe(0)
    expect(distribution.byHour[9].count).toBe(2)
    expect(distribution.punchCard[0][9]).toBe(2)
    expect(distribution.peakWindow?.startHour).toBeDefined()
  })

  it('returns null peakWindow with no timed events', () => {
    const events = [
      event({
        start: new Date('2025-06-04T00:00:00Z'),
        end: new Date('2025-06-05T00:00:00Z'),
        isAllDay: true,
      }),
    ]
    const distribution = computeDistribution(events, range)
    expect(distribution.peakWindow).toBeNull()
  })
})

describe('computeInsights', () => {
  it('returns no insights for an empty calendar', () => {
    expect(computeInsights([], range, { timeZone: 'UTC' })).toEqual([])
  })

  it('flags overloaded days', () => {
    const events = [
      event({
        start: new Date('2025-06-02T08:00:00Z'),
        end: new Date('2025-06-02T13:00:00Z'),
      }),
      event({
        start: new Date('2025-06-02T13:00:00Z'),
        end: new Date('2025-06-02T18:00:00Z'),
      }),
    ]
    const insights = computeInsights(events, range, { timeZone: 'UTC' })
    const overloaded = insights.find((i) => i.type === 'overloaded_days')
    expect(overloaded).toBeDefined()
    expect(overloaded?.severity).toBe('warning')
    if (overloaded?.type === 'overloaded_days') {
      expect(overloaded.data.days).toBe(1)
      expect(overloaded.data.maxHours).toBe(10)
      expect(overloaded.data.thresholdHours).toBe(
        INSIGHT_THRESHOLDS.overloadHours,
      )
    }
  })

  it('detects a volume trend vs the previous period', () => {
    const prevEvents = Array.from({ length: 5 }, (_, i) =>
      event({
        start: new Date(Date.UTC(2025, 4, 20 + i, 10)),
        end: new Date(Date.UTC(2025, 4, 20 + i, 11)),
      }),
    )
    const currentEvents = Array.from({ length: 10 }, (_, i) =>
      event({
        start: new Date(Date.UTC(2025, 5, 2 + (i % 12), 10)),
        end: new Date(Date.UTC(2025, 5, 2 + (i % 12), 11)),
      }),
    )
    const insights = computeInsights([...prevEvents, ...currentEvents], range, {
      timeZone: 'UTC',
    })
    const trend = insights.find((i) => i.type === 'volume_trend')
    expect(trend).toBeDefined()
    if (trend?.type === 'volume_trend') {
      expect(trend.data.changePct).toBe(100)
      expect(trend.data.currentCount).toBe(10)
      expect(trend.data.previousCount).toBe(5)
    }
  })

  it('detects busy streaks', () => {
    const events = Array.from({ length: 4 }, (_, i) =>
      event({
        start: new Date(Date.UTC(2025, 5, 2 + i, 10)),
        end: new Date(Date.UTC(2025, 5, 2 + i, 11)),
      }),
    )
    const insights = computeInsights(events, range, { timeZone: 'UTC' })
    const streak = insights.find((i) => i.type === 'long_streak')
    expect(streak).toBeDefined()
    if (streak?.type === 'long_streak') {
      expect(streak.data.days).toBe(4)
      expect(streak.data.startDate).toBe('2025-06-02')
      expect(streak.data.endDate).toBe('2025-06-05')
    }
  })

  it('flags a fully-booked range as no_free_days', () => {
    const events = Array.from({ length: 14 }, (_, i) =>
      event({
        start: new Date(Date.UTC(2025, 5, 1 + i, 10)),
        end: new Date(Date.UTC(2025, 5, 1 + i, 11)),
      }),
    )
    const insights = computeInsights(events, range, { timeZone: 'UTC' })
    expect(insights.find((i) => i.type === 'no_free_days')).toBeDefined()
    expect(insights.find((i) => i.type === 'long_streak')).toBeUndefined()
  })

  it('flags fragmentation when most events are short', () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      event({
        start: new Date(Date.UTC(2025, 5, 2 + (i % 10), 10)),
        end: new Date(Date.UTC(2025, 5, 2 + (i % 10), 10, 20)),
      }),
    )
    const insights = computeInsights(events, range, { timeZone: 'UTC' })
    const fragmented = insights.find((i) => i.type === 'fragmented')
    expect(fragmented).toBeDefined()
    if (fragmented?.type === 'fragmented') {
      expect(fragmented.data.shortPct).toBe(100)
    }
  })

  it('detects category share shifts', () => {
    const prevEvents = Array.from({ length: 10 }, (_, i) =>
      event({
        start: new Date(Date.UTC(2025, 4, 19 + (i % 13), 10)),
        end: new Date(Date.UTC(2025, 4, 19 + (i % 13), 11)),
        categoryId: 'work',
      }),
    )
    const currentEvents = [
      ...Array.from({ length: 5 }, (_, i) =>
        event({
          start: new Date(Date.UTC(2025, 5, 2 + i, 10)),
          end: new Date(Date.UTC(2025, 5, 2 + i, 11)),
          categoryId: 'work',
        }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        event({
          start: new Date(Date.UTC(2025, 5, 2 + i, 14)),
          end: new Date(Date.UTC(2025, 5, 2 + i, 15)),
          categoryId: 'fitness',
        }),
      ),
    ]
    const insights = computeInsights([...prevEvents, ...currentEvents], range, {
      timeZone: 'UTC',
    })
    const shift = insights.find((i) => i.type === 'category_shift')
    expect(shift).toBeDefined()
    if (shift?.type === 'category_shift') {
      expect(['work', 'fitness']).toContain(shift.data.categoryId)
      expect(
        Math.abs(shift.data.toPct - shift.data.fromPct),
      ).toBeGreaterThanOrEqual(INSIGHT_THRESHOLDS.categoryShiftPp)
    }
  })

  it('detects planning lead time', () => {
    const events = Array.from({ length: 6 }, (_, i) =>
      event({
        start: new Date(Date.UTC(2025, 5, 2 + i, 10)),
        end: new Date(Date.UTC(2025, 5, 2 + i, 11)),
        createdAt: new Date(Date.UTC(2025, 4, 10 + i, 10)),
      }),
    )
    const insights = computeInsights(events, range, { timeZone: 'UTC' })
    expect(insights.find((i) => i.type === 'planning_ahead')).toBeDefined()
  })

  it('sorts warnings before info and positive', () => {
    const events = [
      // Overloaded day (warning)
      event({
        start: new Date('2025-06-02T08:00:00Z'),
        end: new Date('2025-06-02T18:00:00Z'),
      }),
      // Plus enough events for busiest_weekday (info)
      ...Array.from({ length: 6 }, (_, i) =>
        event({
          start: new Date(Date.UTC(2025, 5, 3 + (i % 5), 10)),
          end: new Date(Date.UTC(2025, 5, 3 + (i % 5), 11)),
        }),
      ),
    ]
    const insights = computeInsights(events, range, { timeZone: 'UTC' })
    expect(insights.length).toBeGreaterThan(1)
    expect(insights[0].severity).toBe('warning')
  })
})

describe('filterByStart', () => {
  it('is inclusive of range boundaries', () => {
    const events = [
      event({ start: range.start }),
      event({ start: range.end }),
      event({ start: new Date(range.end.getTime() + 1) }),
    ]
    expect(filterByStart(events, range)).toHaveLength(2)
  })
})
