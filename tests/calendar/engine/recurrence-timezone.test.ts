import { describe, it, expect } from 'vitest'
import { expandSeries } from '@zntr/calendar-ui/lib/recurrence/engine'
import type { RecurrenceEvent } from '@zntr/calendar-ui/lib/recurrence'

const WINDOW = new Date('2026-01-01T00:00:00Z')

function shanghai(y: number, m: number, d: number, h = 7): Date {
  // The fixture is a Shanghai wall clock, independently of the runner's TZ.
  return new Date(Date.UTC(y, m - 1, d, h - 8))
}

function inShanghai(date: Date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map(({ type, value }) => [type, value]),
  )
}

function makeSeries(overrides: Partial<RecurrenceEvent> = {}): RecurrenceEvent {
  return {
    id: 's',
    startDate: shanghai(2026, 7, 21, 7),
    endDate: shanghai(2026, 7, 21, 8),
    isAllDay: false,
    rrule: 'FREQ=WEEKLY;BYDAY=TU',
    exdate: null,
    ...overrides,
  }
}

describe('timezone-anchored expansion (server UTC, user +8)', () => {
  it('weekly BYDAY=TU stays Tuesday in Asia/Shanghai', () => {
    const items = expandSeries(
      makeSeries(),
      WINDOW,
      new Date('2026-08-31T00:00:00Z'),
      10,
      'Asia/Shanghai',
    )
    for (const it of items) {
      expect(inShanghai(it.startDate).weekday).toBe('Tue')
      expect(inShanghai(it.startDate).hour).toBe('07')
    }
    expect(items[0].startDate.toISOString()).toBe('2026-07-20T23:00:00.000Z')
  })

  it('weekly BYDAY=TU with process-local mode matches Shanghai when local is +8', () => {
    if (new Date().getTimezoneOffset() !== -480) return
    expect(
      expandSeries(
        makeSeries(),
        WINDOW,
        new Date('2026-08-31T00:00:00Z'),
        10,
      ).map((i) => i.startDate.toISOString()),
    ).toEqual(
      expandSeries(
        makeSeries(),
        WINDOW,
        new Date('2026-08-31T00:00:00Z'),
        10,
        'Asia/Shanghai',
      ).map((i) => i.startDate.toISOString()),
    )
  })

  it('monthly BYMONTHDAY=21 lands on the 21st in Asia/Shanghai', () => {
    const items = expandSeries(
      makeSeries({ rrule: 'FREQ=MONTHLY;BYMONTHDAY=21' }),
      WINDOW,
      new Date('2026-12-31T00:00:00Z'),
      10,
      'Asia/Shanghai',
    )
    expect(items.length).toBeGreaterThanOrEqual(3)
    for (const it of items) {
      expect(inShanghai(it.startDate).day).toBe('21')
    }
  })

  it('yearly BYMONTH/BYMONTHDAY lands on Jul 21 in Asia/Shanghai', () => {
    const items = expandSeries(
      makeSeries({ rrule: 'FREQ=YEARLY;BYMONTH=7;BYMONTHDAY=21' }),
      WINDOW,
      new Date('2030-12-31T00:00:00Z'),
      10,
      'Asia/Shanghai',
    )
    expect(items.length).toBeGreaterThanOrEqual(3)
    for (const it of items) {
      expect(inShanghai(it.startDate).month).toBe('07')
      expect(inShanghai(it.startDate).day).toBe('21')
    }
  })

  it('all-day weekly TU keeps Tuesday + tz-day recurrenceId in Asia/Shanghai', () => {
    const items = expandSeries(
      makeSeries({
        isAllDay: true,
        startDate: shanghai(2026, 7, 21, 0),
        endDate: shanghai(2026, 7, 22, 0),
      }),
      WINDOW,
      new Date('2026-08-31T00:00:00Z'),
      10,
      'Asia/Shanghai',
    )
    for (const it of items) {
      const parts = inShanghai(it.startDate)
      expect(it.recurrenceId).toBe(`${parts.year}${parts.month}${parts.day}`)
      expect(parts.hour).toBe('00')
    }
    expect(items[0].recurrenceId).toBe('20260721')
    expect(items[0].startDate.toISOString()).toBe('2026-07-20T16:00:00.000Z')
    expect(inShanghai(items[0].startDate).weekday).toBe('Tue')
  })
})
