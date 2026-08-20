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
  canTranslateRuleByDays,
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

  it('refuses to shift a BYSETPOS rule: "2nd Tuesday + 1 day" is not nameable', () => {
    // BYSETPOS selects the nth match within the period. Rotating the weekday
    // keeps the positional selection, so the result is NOT the original date
    // plus one day (the 2nd Tuesday and the 2nd Wednesday can be six days
    // apart). Refusing keeps the rule honest.
    const rule = 'FREQ=MONTHLY;BYDAY=TU;BYSETPOS=2'
    expect(canTranslateRuleByDays(rule, 1)).toBe(false)
    expect(
      translateRuleByDays(rule, 1, day(2026, 8, 12, 9), false, 'UTC'),
    ).toBe(rule)
  })

  it('shifts month and day for a yearly rule', () => {
    const out = translateRuleByDays(
      'FREQ=YEARLY;BYMONTH=8;BYMONTHDAY=15',
      1,
      day(2026, 8, 16, 9),
      false,
      'UTC',
    )
    expect(out).toContain('BYMONTH=8')
    expect(out).toContain('BYMONTHDAY=16')
  })

  it('refuses to shift a day-of-month out of range instead of corrupting it', () => {
    // Aug 31 + 1 day has no BYMONTHDAY that means "the day after the 31st" in
    // every month, so the rule is returned unchanged and the caller's
    // canTranslateRuleByDays guard rejects the edit.
    const rule = 'FREQ=YEARLY;BYMONTH=8;BYMONTHDAY=31'
    expect(translateRuleByDays(rule, 1, day(2026, 9, 1, 9), false, 'UTC')).toBe(
      rule,
    )
    expect(canTranslateRuleByDays(rule, 1)).toBe(false)
  })

  it('refuses shifts that cross a month-length boundary', () => {
    // Found by the invariant fuzz: BYMONTHDAY=31 exists in 7 months, the 30th
    // in 11, the 29th in 12. Shifting between those classes adds or removes
    // occurrences (31 → 30 gains four a year), so the shift is refused.
    expect(canTranslateRuleByDays('FREQ=MONTHLY;BYMONTHDAY=31', -1)).toBe(false)
    expect(canTranslateRuleByDays('FREQ=MONTHLY;BYMONTHDAY=30', -1)).toBe(false)
    expect(canTranslateRuleByDays('FREQ=MONTHLY;BYMONTHDAY=29,30,31', -1)).toBe(
      false,
    )
    // Days that exist in every month shift freely.
    expect(canTranslateRuleByDays('FREQ=MONTHLY;BYMONTHDAY=15', 1)).toBe(true)
    expect(canTranslateRuleByDays('FREQ=MONTHLY;BYMONTHDAY=1,15', 1)).toBe(true)
    // 28 → 29 keeps the same month count (both 12), so it is allowed.
    expect(canTranslateRuleByDays('FREQ=MONTHLY;BYMONTHDAY=28', 1)).toBe(true)
    // Feb 29 → Mar 1 would turn a leap-year-only event into a yearly one.
    expect(
      canTranslateRuleByDays('FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29', 1),
    ).toBe(false)
  })

  it('refuses shifting a DAILY/WEEKLY rule that is filtered by BYMONTH', () => {
    // Also found by the fuzz: BYMONTH on a sub-monthly rule keeps only the days
    // inside those months, so moving the pattern changes which days survive the
    // filter and the spacing at each month boundary.
    expect(canTranslateRuleByDays('FREQ=DAILY;INTERVAL=1;BYMONTH=12', 1)).toBe(
      false,
    )
    expect(canTranslateRuleByDays('FREQ=WEEKLY;BYDAY=MO;BYMONTH=6,7', 1)).toBe(
      false,
    )
    // Without the filter the same rule shifts fine.
    expect(canTranslateRuleByDays('FREQ=DAILY;INTERVAL=1', 1)).toBe(true)
  })

  it('refuses last-day-of-month and partial-week BYWEEKNO shifts', () => {
    expect(canTranslateRuleByDays('FREQ=MONTHLY;BYMONTHDAY=-1', 1)).toBe(false)
    expect(canTranslateRuleByDays('FREQ=YEARLY;BYWEEKNO=20;BYDAY=MO', 1)).toBe(
      false,
    )
    // A whole-week shift of a BYWEEKNO rule IS expressible.
    expect(canTranslateRuleByDays('FREQ=YEARLY;BYWEEKNO=20;BYDAY=MO', 7)).toBe(
      true,
    )
  })

  it('translates multi-value fields element-wise, never collapsing them', () => {
    // The regression this guards: BYMONTHDAY=1,15 used to become a single
    // anchor day, silently deleting half the occurrences.
    const monthly = translateRuleByDays(
      'FREQ=MONTHLY;BYMONTHDAY=1,15',
      1,
      day(2026, 8, 2, 9),
      false,
      'UTC',
    )
    const days = /BYMONTHDAY=([^;]+)/
      .exec(monthly)![1]
      .split(',')
      .map(Number)
      .sort((a, b) => a - b)
    expect(days).toEqual([2, 16])

    // Quarterly rules keep all four months.
    const quarterly = translateRuleByDays(
      'FREQ=YEARLY;BYMONTH=3,6,9,12;BYMONTHDAY=15',
      1,
      day(2026, 3, 16, 9),
      false,
      'UTC',
    )
    const months = /BYMONTH=([^;]+)/
      .exec(quarterly)![1]
      .split(',')
      .map(Number)
      .sort((a, b) => a - b)
    expect(months).toEqual([3, 6, 9, 12])
    expect(quarterly).toContain('BYMONTHDAY=16')
  })

  it('shifts an ordinal weekday by whole weeks and refuses partial weeks', () => {
    // "2nd Monday + 7 days" IS the 3rd Monday.
    const weekShift = translateRuleByDays(
      'FREQ=MONTHLY;BYDAY=2MO',
      7,
      day(2026, 8, 17, 9),
      false,
      'UTC',
    )
    expect(weekShift).toMatch(/3MO/)
    expect(canTranslateRuleByDays('FREQ=MONTHLY;BYDAY=2MO', 7)).toBe(true)

    // "2nd Monday + 1 day" is the 2nd Tuesday in some months and the 3rd in
    // others, so it has no fixed rule and must be refused.
    expect(canTranslateRuleByDays('FREQ=MONTHLY;BYDAY=2MO', 1)).toBe(false)
    expect(
      translateRuleByDays(
        'FREQ=MONTHLY;BYDAY=2MO',
        1,
        day(2026, 8, 11, 9),
        false,
        'UTC',
      ),
    ).toBe('FREQ=MONTHLY;BYDAY=2MO')

    // Past the 5th week there is no such ordinal in any month.
    expect(canTranslateRuleByDays('FREQ=MONTHLY;BYDAY=5MO', 7)).toBe(false)
  })

  it('refuses a partial-week shift of an interval>1 weekly rule', () => {
    // Every 2nd week counts from the anchor's week; a 1-day shift can move the
    // anchor into the previous/next week and flip the phase, changing the
    // spacing between occurrences from 14 days to 7 or 21.
    const rule = 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH'
    expect(canTranslateRuleByDays(rule, 1)).toBe(false)
    expect(canTranslateRuleByDays(rule, -1)).toBe(false)
    // Whole-week shifts move the anchor with the pattern and are safe.
    expect(canTranslateRuleByDays(rule, 7)).toBe(true)
    const out = translateRuleByDays(rule, 7, day(2026, 8, 11, 9), false, 'UTC')
    expect(out).toContain('INTERVAL=2')
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
    // INTERVAL=1 so the shift is expressible (see the interval>1 case above).
    const out = translateRuleByDays(
      'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;COUNT=10',
      1,
      day(2026, 8, 4, 9),
      false,
      'UTC',
    )
    expect(out).toContain('INTERVAL=1')
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
