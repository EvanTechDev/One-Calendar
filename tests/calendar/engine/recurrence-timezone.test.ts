import { describe, it, expect } from 'vitest'
import { expandSeries, toRfcStamp } from '@/lib/recurrence/engine'
import type { RecurrenceEvent } from '@/lib/recurrence'

const WINDOW = new Date('2026-01-01T00:00:00Z')

function local(y: number, m: number, d: number, h = 7): Date {
  return new Date(y, m - 1, d, h)
}

function makeSeries(overrides: Partial<RecurrenceEvent> = {}): RecurrenceEvent {
  return {
    id: 's',
    startDate: local(2026, 7, 21, 7),
    endDate: new Date(local(2026, 7, 21, 7).getTime() + 60 * 60 * 1000),
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
      expect(it.startDate.toString()).toMatch(/^Tue /)
      expect(it.startDate.getHours()).toBe(7)
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
      expect(it.startDate.getDate()).toBe(21)
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
      expect(it.startDate.getMonth()).toBe(6)
      expect(it.startDate.getDate()).toBe(21)
    }
  })

  it('all-day weekly TU keeps Tuesday + tz-day recurrenceId in Asia/Shanghai', () => {
    const items = expandSeries(
      makeSeries({ isAllDay: true, startDate: local(2026, 7, 21, 0) }),
      WINDOW,
      new Date('2026-08-31T00:00:00Z'),
      10,
      'Asia/Shanghai',
    )
    for (const it of items) {
      expect(it.recurrenceId).toBe(toRfcStamp(it.startDate, true))
      expect(it.startDate.getHours()).toBe(0)
    }
    expect(items[0].startDate.toString()).toMatch(/^Tue /)
  })
})
