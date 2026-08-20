/**
 * Pins the whole-pattern day-translation primitives behind the two edit
 * semantics:
 *
 * - "all events" moved to another weekday translates the WHOLE pattern by
 *   that day distance (Mon/Wed/Fri/Sun + 1 → Tue/Thu/Sat/Mon) instead of
 *   collapsing it onto one weekday.
 * - "this and following" snaps back onto the parent pattern (only the clock
 *   is adopted), so a Tuesday drop never adds a Tuesday to the series.
 *
 * Covers every FREQ shape, not just weekly, plus DST safety.
 */
import { describe, it, expect } from 'vitest'
import {
  addWallClockDays,
  snapToPatternDay,
  translateRuleByDays,
  translateStampsByDays,
  wallClockDayDelta,
} from '@/lib/recurrence/engine'

function day(y: number, m: number, d: number, h = 0, min = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, h, min, 0))
}

describe('wallClockDayDelta', () => {
  it('measures whole calendar days regardless of time of day', () => {
    // Mon 09:00 → Tue 15:00 is +1 day even though it is only 30 hours.
    expect(
      wallClockDayDelta(day(2026, 8, 3, 9), day(2026, 8, 4, 15), 'UTC'),
    ).toBe(1)
    // Wed 09:00 → Tue 15:00 is -1 day.
    expect(
      wallClockDayDelta(day(2026, 8, 5, 9), day(2026, 8, 4, 15), 'UTC'),
    ).toBe(-1)
  })

  it('is zero for a same-day clock change', () => {
    expect(
      wallClockDayDelta(day(2026, 8, 3, 9), day(2026, 8, 3, 17), 'UTC'),
    ).toBe(0)
  })

  it('spans month and year boundaries', () => {
    expect(
      wallClockDayDelta(day(2026, 8, 31, 9), day(2026, 9, 1, 9), 'UTC'),
    ).toBe(1)
    expect(
      wallClockDayDelta(day(2026, 12, 31, 9), day(2027, 1, 1, 9), 'UTC'),
    ).toBe(1)
  })
})

describe('addWallClockDays', () => {
  it('keeps the wall-clock time of day', () => {
    expect(addWallClockDays(day(2026, 8, 3, 9, 30), 1, 'UTC')).toEqual(
      day(2026, 8, 4, 9, 30),
    )
  })

  it('keeps 09:00 across a DST transition in a real timezone', () => {
    // US DST ends 2026-11-01. 09:00 local before and after must stay 09:00.
    const before = new Date('2026-10-31T13:00:00Z') // 09:00 EDT
    const moved = addWallClockDays(before, 2, 'America/New_York')
    const local = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(moved)
    expect(local).toBe('09:00')
  })
})

describe('translateRuleByDays', () => {
  it('rotates every BYDAY entry of a weekly rule', () => {
    // Mon/Wed/Fri/Sun + 1 day → Tue/Thu/Sat/Mon.
    const out = translateRuleByDays(
      'FREQ=WEEKLY;BYDAY=MO,WE,FR,SU',
      1,
      day(2026, 8, 4, 15),
      false,
      'UTC',
    )
    expect(out).toContain('BYDAY=')
    const byday = /BYDAY=([^;]+)/.exec(out)![1].split(',').sort()
    expect(byday).toEqual(['MO', 'SA', 'TH', 'TU'])
  })

  it('wraps weekdays across the week boundary', () => {
    // Sunday + 1 → Monday (wrap), Saturday + 1 → Sunday.
    const out = translateRuleByDays(
      'FREQ=WEEKLY;BYDAY=SA,SU',
      1,
      day(2026, 8, 3, 9),
      false,
      'UTC',
    )
    const byday = /BYDAY=([^;]+)/.exec(out)![1].split(',').sort()
    expect(byday).toEqual(['MO', 'SU'])
  })

  it('handles a negative delta', () => {
    const out = translateRuleByDays(
      'FREQ=WEEKLY;BYDAY=WE',
      -1,
      day(2026, 8, 4, 9),
      false,
      'UTC',
    )
    expect(out).toContain('BYDAY=TU')
  })

  it('shifts BYMONTHDAY for a monthly rule', () => {
    const out = translateRuleByDays(
      'FREQ=MONTHLY;BYMONTHDAY=15',
      1,
      day(2026, 8, 16, 9),
      false,
      'UTC',
    )
    expect(out).toContain('BYMONTHDAY=16')
  })

  it('rotates the weekday of an nth-weekday monthly rule, keeping the ordinal', () => {
    const out = translateRuleByDays(
      'FREQ=MONTHLY;BYDAY=TU;BYSETPOS=2',
      1,
      day(2026, 8, 12, 9),
      false,
      'UTC',
    )
    expect(out).toContain('BYDAY=WE')
    expect(out).toContain('BYSETPOS=2')
  })

  it('shifts month and day for a yearly rule', () => {
    const out = translateRuleByDays(
      'FREQ=YEARLY;BYMONTH=8;BYMONTHDAY=31',
      1,
      day(2026, 9, 1, 9),
      false,
      'UTC',
    )
    expect(out).toContain('BYMONTH=9')
    expect(out).toContain('BYMONTHDAY=1')
  })

  it('leaves a daily rule alone (nothing to rotate)', () => {
    const out = translateRuleByDays(
      'FREQ=DAILY;INTERVAL=1',
      1,
      day(2026, 8, 4, 9),
      false,
      'UTC',
    )
    expect(out).toContain('FREQ=DAILY')
    expect(out).not.toContain('BYDAY')
  })

  it('moves an absolute UNTIL bound with the pattern', () => {
    const out = translateRuleByDays(
      'FREQ=WEEKLY;BYDAY=MO;UNTIL=20261130T090000Z',
      1,
      day(2026, 8, 4, 9),
      false,
      'UTC',
    )
    expect(out).toContain('BYDAY=TU')
    expect(out).toMatch(/UNTIL=20261201/)
  })

  it('preserves COUNT and INTERVAL', () => {
    const out = translateRuleByDays(
      'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO;COUNT=10',
      1,
      day(2026, 8, 4, 9),
      false,
      'UTC',
    )
    expect(out).toContain('INTERVAL=2')
    expect(out).toContain('COUNT=10')
    expect(out).toContain('BYDAY=TU')
  })

  it('returns the rule unchanged for a zero delta', () => {
    const rule = 'FREQ=WEEKLY;BYDAY=MO,WE'
    expect(translateRuleByDays(rule, 0, day(2026, 8, 3, 9), false, 'UTC')).toBe(
      rule,
    )
  })

  it('returns the input unchanged when it cannot be parsed', () => {
    expect(
      translateRuleByDays('NOT-A-RULE', 1, day(2026, 8, 4), false, 'UTC'),
    ).toBe('NOT-A-RULE')
  })
})

describe('translateStampsByDays', () => {
  it('moves timed stamps by whole days and applies the new clock', () => {
    expect(
      translateStampsByDays(
        ['20260805T090000Z', '20260807T090000Z'],
        1,
        day(2026, 8, 4, 15),
        'UTC',
      ),
    ).toEqual(['20260806T150000Z', '20260808T150000Z'])
  })

  it('moves all-day stamps by days without a clock', () => {
    expect(
      translateStampsByDays(['20260805'], 1, day(2026, 8, 4, 15), 'UTC'),
    ).toEqual(['20260806'])
  })

  it('returns null for an empty list', () => {
    expect(translateStampsByDays(null, 1, day(2026, 8, 4), 'UTC')).toBeNull()
    expect(translateStampsByDays([], 1, day(2026, 8, 4), 'UTC')).toBeNull()
  })
})

describe('snapToPatternDay', () => {
  it('keeps the pattern day and adopts the dragged time of day', () => {
    // Dragged Wednesday's 09:00 instance onto Tuesday 15:00 → Wednesday 15:00.
    expect(
      snapToPatternDay(day(2026, 8, 5, 9), day(2026, 8, 4, 15), 'UTC'),
    ).toEqual(day(2026, 8, 5, 15))
  })

  it('is a no-op when the drop is on the pattern day already', () => {
    expect(
      snapToPatternDay(day(2026, 8, 5, 9), day(2026, 8, 5, 15), 'UTC'),
    ).toEqual(day(2026, 8, 5, 15))
  })
})
