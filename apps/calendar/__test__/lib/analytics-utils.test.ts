import { describe, it, expect } from 'vitest'
import {
  normalizeChartColor,
  getChartColorOrderIndex,
  resolveDateRange,
  mapEventsToAnalyticsEvents,
  filterEventsInRange,
  getPreviousRange,
  generateRangeDays,
  groupDayKey,
  groupMonthKey,
  getMonthDays,
  toMondayIndex,
  formatHourRange,
  calculateDaySpanInHours,
  addDurationByDayCategory,
} from '@/components/app/analytics/analytics-utils'
import type { CalendarEvent } from '@/components/app/calendar'
import type { AnalyticsEvent } from '@/components/app/analytics/analytics-types'

function createEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: '1',
    title: 'Test Event',
    startDate: new Date('2025-01-15T10:00:00'),
    endDate: new Date('2025-01-15T11:00:00'),
    isAllDay: false,
    recurrence: 'none',
    participants: [],
    notification: 0,
    description: '',
    location: '',
    color: 'bg-blue-500',
    calendarId: 'cal-1',
    ...overrides,
  }
}

function createAnalyticsEvent(
  overrides: Partial<AnalyticsEvent> = {},
): AnalyticsEvent {
  return {
    id: '1',
    start: new Date('2025-01-15T10:00:00'),
    end: new Date('2025-01-15T11:00:00'),
    category: 'work',
    color: '#3b82f6',
    createdAt: new Date('2025-01-01T00:00:00'),
    ...overrides,
  }
}

describe('normalizeChartColor', () => {
  it('returns fallback for undefined input', () => {
    expect(normalizeChartColor(undefined)).toBe('#64748b')
  })

  it('passes through hex colors', () => {
    expect(normalizeChartColor('#3b82f6')).toBe('#3b82f6')
  })

  it('passes through rgb colors', () => {
    expect(normalizeChartColor('rgb(59, 130, 246)')).toBe('rgb(59, 130, 246)')
  })

  it('passes through hsl colors', () => {
    expect(normalizeChartColor('hsl(200, 50%, 50%)')).toBe('hsl(200, 50%, 50%)')
  })

  it('maps tailwind bg- classes to hex', () => {
    expect(normalizeChartColor('bg-blue-500')).toBe('#3b82f6')
    expect(normalizeChartColor('bg-red-500')).toBe('#ef4444')
  })

  it('maps bg-[] colors to hex', () => {
    expect(normalizeChartColor('bg-[#E6F6FD]')).toBe('#3B82F6')
  })

  it('returns fallback for unknown class', () => {
    expect(normalizeChartColor('bg-unknown')).toBe('#64748b')
  })
})

describe('getChartColorOrderIndex', () => {
  it('returns index for known color in chart order', () => {
    const index = getChartColorOrderIndex('#3b82f6')
    expect(index).toBeGreaterThanOrEqual(0)
    expect(index).toBeLessThan(7)
  })

  it('returns MAX_SAFE_INTEGER for unknown color', () => {
    const index = getChartColorOrderIndex('#unknowncolor')
    expect(index).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('normalizes color before lookup', () => {
    const index = getChartColorOrderIndex('bg-blue-500')
    expect(index).toBe(0)
  })
})

describe('resolveDateRange', () => {
  const now = new Date('2025-01-15T12:00:00')

  it('returns 7 days for week preset', () => {
    const range = resolveDateRange('week', now)
    // The range is inclusive (start to end), so 7 days = 6 day difference
    const diffDays =
      (range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24)
    expect(Math.round(diffDays)).toBe(7)
    expect(range.end.getTime()).toBeGreaterThan(range.start.getTime())
  })

  it('returns 30 days for month preset', () => {
    const range = resolveDateRange('month', now)
    const diffDays =
      (range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24)
    expect(Math.round(diffDays)).toBe(30)
  })

  it('returns 90 days for quarter preset', () => {
    const range = resolveDateRange('quarter', now)
    const diffDays =
      (range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24)
    expect(Math.round(diffDays)).toBe(90)
  })
})

describe('mapEventsToAnalyticsEvents', () => {
  it('converts CalendarEvent to AnalyticsEvent', () => {
    const events = [createEvent()]
    const result = mapEventsToAnalyticsEvents(events)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
    expect(result[0].category).toBe('cal-1')
    expect(result[0].color).toBe('#3b82f6')
  })

  it('filters out events with invalid dates', () => {
    const events = [
      createEvent({ startDate: new Date('invalid') }),
      createEvent({ id: '2', endDate: new Date('invalid') }),
      createEvent({ id: '3' }),
    ]
    const result = mapEventsToAnalyticsEvents(events)
    expect(result).toHaveLength(1)
  })

  it('falls back to start date for missing createdAt', () => {
    const event = createEvent({ description: '' })
    const result = mapEventsToAnalyticsEvents([event])
    expect(result[0].createdAt).toEqual(event.startDate)
  })

  it('parses ISO string dates', () => {
    const event = createEvent({
      startDate: new Date('2025-01-15T10:00:00.000Z'),
      endDate: new Date('2025-01-15T11:00:00.000Z'),
      description: '',
    })
    const result = mapEventsToAnalyticsEvents([event])
    expect(result[0].start).toEqual(new Date('2025-01-15T10:00:00.000Z'))
    expect(result[0].createdAt).toEqual(new Date('2025-01-01T00:00:00.000Z'))
  })
})

describe('filterEventsInRange', () => {
  const events: AnalyticsEvent[] = [
    createAnalyticsEvent({ id: '1', start: new Date('2025-01-15T10:00:00') }),
    createAnalyticsEvent({ id: '2', start: new Date('2025-01-20T10:00:00') }),
    createAnalyticsEvent({ id: '3', start: new Date('2025-02-01T10:00:00') }),
  ]

  it('includes events within range', () => {
    const range = { start: new Date('2025-01-10'), end: new Date('2025-01-31') }
    const result = filterEventsInRange(events, range)
    expect(result).toHaveLength(2)
    expect(result.map((e) => e.id)).toEqual(['1', '2'])
  })

  it('excludes events outside range', () => {
    const range = { start: new Date('2025-02-10'), end: new Date('2025-02-20') }
    const result = filterEventsInRange(events, range)
    expect(result).toHaveLength(0)
  })

  it('includes events on range boundaries', () => {
    const range = {
      start: new Date('2025-01-15T00:00:00'),
      end: new Date('2025-01-15T23:59:59'),
    }
    const result = filterEventsInRange(events, range)
    expect(result).toHaveLength(1)
  })
})

describe('getPreviousRange', () => {
  it('returns previous range of same length', () => {
    const range = {
      start: new Date('2025-01-15T00:00:00'),
      end: new Date('2025-01-21T23:59:59'),
    } // 7 days
    const prev = getPreviousRange(range)
    // Previous range should be 7 days before (approximately)
    const diff = prev.start.getTime() - range.start.getTime()
    expect(diff).toBeLessThan(-6 * 24 * 60 * 60 * 1000) // At least 6 days before
    expect(diff).toBeGreaterThan(-8 * 24 * 60 * 60 * 1000) // At most 8 days before
    expect(prev.start.getTime()).toBeLessThan(range.start.getTime())
    expect(prev.end.getTime()).toBeLessThan(range.end.getTime())
  })

  it('handles single day range', () => {
    const range = {
      start: new Date('2025-01-15T00:00:00'),
      end: new Date('2025-01-15T23:59:59'),
    }
    const prev = getPreviousRange(range)
    expect(prev.start.getTime()).toBeLessThan(range.start.getTime())
    expect(prev.end.getTime()).toBeLessThan(range.end.getTime())
    // Previous range should be 1 day before (approximately)
    const diff = prev.start.getTime() - range.start.getTime()
    expect(diff).toBeLessThan(-20 * 60 * 60 * 1000) // At least ~20 hours
    expect(diff).toBeGreaterThan(-28 * 60 * 60 * 1000) // At most ~28 hours
  })
})

describe('generateRangeDays', () => {
  it('generates all days in range', () => {
    const range = {
      start: new Date('2025-01-15T00:00:00'),
      end: new Date('2025-01-17T00:00:00'),
    }
    const days = generateRangeDays(range)
    expect(days).toHaveLength(3)
    // Verify each day is sequential
    expect(days[1].getTime() - days[0].getTime()).toBe(24 * 60 * 60 * 1000)
    expect(days[2].getTime() - days[1].getTime()).toBe(24 * 60 * 60 * 1000)
  })
})

describe('groupDayKey', () => {
  it('formats date as yyyy-MM-dd', () => {
    expect(groupDayKey(new Date('2025-01-15'))).toBe('2025-01-15')
  })
})

describe('groupMonthKey', () => {
  it('formats date as yyyy-MM', () => {
    expect(groupMonthKey(new Date('2025-01-15'))).toBe('2025-01')
  })
})

describe('getMonthDays', () => {
  it('returns all days in a year', () => {
    const days = getMonthDays(2025)
    expect(days).toHaveLength(365) // 2025 is not a leap year
    // Verify first and last days are sequential
    expect(days[1].getTime() - days[0].getTime()).toBe(24 * 60 * 60 * 1000)
    expect(
      days[days.length - 1].getTime() - days[days.length - 2].getTime(),
    ).toBe(24 * 60 * 60 * 1000)
    // Verify first day is in January
    expect(days[0].getMonth()).toBe(0)
    // Verify last day is in December
    expect(days[days.length - 1].getMonth()).toBe(11)
  })

  it('returns 366 days for leap year', () => {
    const days = getMonthDays(2024)
    expect(days).toHaveLength(366)
  })
})

describe('toMondayIndex', () => {
  it('returns 0 for Monday', () => {
    expect(toMondayIndex(new Date('2025-01-13'))).toBe(0) // Monday
  })

  it('returns 6 for Sunday', () => {
    expect(toMondayIndex(new Date('2025-01-12'))).toBe(6) // Sunday
  })

  it('returns 1 for Tuesday', () => {
    expect(toMondayIndex(new Date('2025-01-14'))).toBe(1)
  })
})

describe('formatHourRange', () => {
  it('formats 2-hour range', () => {
    expect(formatHourRange(0)).toBe('00:00 — 02:00')
    expect(formatHourRange(10)).toBe('10:00 — 12:00')
  })

  it('wraps at midnight', () => {
    expect(formatHourRange(22)).toBe('22:00 — 00:00')
    expect(formatHourRange(23)).toBe('23:00 — 01:00')
  })
})

describe('calculateDaySpanInHours', () => {
  it('calculates hours between two dates', () => {
    const hours = calculateDaySpanInHours(
      new Date('2025-01-15T10:00:00'),
      new Date('2025-01-15T12:00:00'),
    )
    expect(hours).toBe(2)
  })

  it('returns 0 for negative span', () => {
    const hours = calculateDaySpanInHours(
      new Date('2025-01-15T12:00:00'),
      new Date('2025-01-15T10:00:00'),
    )
    expect(hours).toBe(0)
  })
})

describe('addDurationByDayCategory', () => {
  it('adds hours to nested bucket', () => {
    const bucket: Record<
      string,
      Record<string, { hours: number; color: string }>
    > = {}
    addDurationByDayCategory(bucket, 'Monday', 'work', '#3b82f6', 2)
    addDurationByDayCategory(bucket, 'Monday', 'work', '#3b82f6', 3)

    expect(bucket.Monday.work.hours).toBe(5)
    expect(bucket.Monday.work.color).toBe('#3b82f6')
  })

  it('creates new day and category entries', () => {
    const bucket: Record<
      string,
      Record<string, { hours: number; color: string }>
    > = {}
    addDurationByDayCategory(bucket, 'Tuesday', 'personal', '#10b981', 1)

    expect(bucket.Tuesday.personal.hours).toBe(1)
    expect(bucket.Tuesday.personal.color).toBe('#10b981')
  })
})
