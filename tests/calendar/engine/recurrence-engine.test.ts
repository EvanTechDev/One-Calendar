import { describe, it, expect } from 'vitest'
import {
  MAX_EXPANSION,
  adaptRuleToStart,
  buildInstanceId,
  describeRecurrence,
  emptyRruleParts,
  expandSeries,
  isInstanceId,
  isSeriesEvent,
  isValidRrule,
  parseInstanceId,
  parseRfcStamp,
  reanchor,
  rruleFromParts,
  rruleToParts,
  toRfcStamp,
  withUntil,
} from '@/lib/recurrence/engine'
import type { RecurrenceEvent, RruleParts } from '@/lib/recurrence'

function day(y: number, m: number, d: number, h = 0, min = 0, s = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, h, min, s))
}

function makeSeries(overrides: Partial<RecurrenceEvent> = {}): RecurrenceEvent {
  return {
    id: 'evt',
    startDate: day(2024, 1, 1),
    endDate: day(2024, 1, 2),
    isAllDay: true,
    rrule: null,
    exdate: null,
    ...overrides,
  }
}

function makeParts(overrides: Partial<RruleParts> = {}): RruleParts {
  return { ...emptyRruleParts('DAILY'), ...overrides }
}

describe('toRfcStamp', () => {
  it('formats all-day dates as YYYYMMDD', () => {
    expect(toRfcStamp(day(2024, 1, 17), true)).toBe('20240117')
  })

  it('formats timed dates as YYYYMMDDTHHMMSSZ in UTC', () => {
    expect(toRfcStamp(day(2024, 1, 17, 12, 30, 45), false)).toBe(
      '20240117T123045Z',
    )
  })

  it('pads all fields', () => {
    expect(toRfcStamp(day(2024, 12, 31, 23, 59, 59), false)).toBe(
      '20241231T235959Z',
    )
    expect(toRfcStamp(day(2000, 1, 1), true)).toBe('20000101')
  })
})

describe('parseRfcStamp', () => {
  it('parses all-day date stamps as UTC midnight', () => {
    const { date, isAllDay } = parseRfcStamp('20240117')
    expect(isAllDay).toBe(true)
    expect(date.getTime()).toBe(day(2024, 1, 17).getTime())
  })

  it('parses timed datetime stamps in UTC', () => {
    const { date, isAllDay } = parseRfcStamp('20240117T123045Z')
    expect(isAllDay).toBe(false)
    expect(date.getTime()).toBe(day(2024, 1, 17, 12, 30, 45).getTime())
  })

  it('round-trips both forms through toRfcStamp', () => {
    const allDay = parseRfcStamp('20240315')
    expect(toRfcStamp(allDay.date, allDay.isAllDay)).toBe('20240315')
    const timed = parseRfcStamp('20240315T235959Z')
    expect(toRfcStamp(timed.date, timed.isAllDay)).toBe('20240315T235959Z')
  })

  it('rejects malformed stamps', () => {
    const bad = [
      '2024017',
      '202401177',
      '20240230',
      '20241301',
      '20240001',
      '20240117T240000Z',
      '20240117T006099Z',
      '20240117T120000',
      '20240117t120000z',
      '20240117T1200Z',
      'not-a-stamp',
      '',
    ]
    for (const stamp of bad) {
      expect(() => parseRfcStamp(stamp)).toThrow(`Invalid RFC stamp: ${stamp}`)
    }
  })
})

describe('buildInstanceId / parseInstanceId / isInstanceId', () => {
  it('round-trips all-day instance ids', () => {
    const id = buildInstanceId('series-1', '20240117')
    expect(id).toBe('series-1_20240117')
    expect(parseInstanceId(id)).toEqual({
      seriesId: 'series-1',
      recurrenceId: '20240117',
    })
  })

  it('round-trips timed instance ids', () => {
    const id = buildInstanceId('series-1', '20240117T120000Z')
    expect(parseInstanceId(id)).toEqual({
      seriesId: 'series-1',
      recurrenceId: '20240117T120000Z',
    })
  })

  it('keeps underscores inside the series id', () => {
    expect(parseInstanceId('a_b_20240117T120000Z')).toEqual({
      seriesId: 'a_b',
      recurrenceId: '20240117T120000Z',
    })
  })

  it('rejects ids without a valid RFC stamp tail', () => {
    const bad = [
      'evt',
      'evt_',
      '_20240117',
      'evt_abc',
      'evt_20240117T250000Z',
      'evt_20240230',
    ]
    for (const id of bad) {
      expect(parseInstanceId(id)).toBeNull()
      expect(isInstanceId(id)).toBe(false)
    }
  })

  it('isInstanceId matches valid instance ids only', () => {
    expect(isInstanceId('evt_20240117')).toBe(true)
    expect(isInstanceId('evt_20240117T090000Z')).toBe(true)
  })
})

describe('isSeriesEvent', () => {
  it('returns true for non-empty rules', () => {
    expect(isSeriesEvent({ rrule: 'FREQ=DAILY' })).toBe(true)
    expect(isSeriesEvent({ rrule: '  FREQ=WEEKLY  ' })).toBe(true)
  })

  it('returns false for null or blank rules', () => {
    expect(isSeriesEvent({ rrule: null })).toBe(false)
    expect(isSeriesEvent({ rrule: '' })).toBe(false)
    expect(isSeriesEvent({ rrule: '   ' })).toBe(false)
  })
})

describe('expandSeries', () => {
  it('expands a finite daily series with per-instance stamps and ids', () => {
    const series = makeSeries({
      id: 'evt',
      startDate: day(2024, 1, 1),
      endDate: day(2024, 1, 3),
      isAllDay: true,
      rrule: 'FREQ=DAILY;COUNT=10',
    })
    const result = expandSeries(series, day(2024, 1, 1), day(2024, 1, 15))
    expect(result).toHaveLength(10)
    expect(result[0].recurrenceId).toBe('20240101')
    expect(result[9].recurrenceId).toBe('20240110')
    expect(result[0].id).toBe('evt_20240101')
    expect(result[9].id).toBe('evt_20240110')
    for (const instance of result) {
      expect(instance.seriesId).toBe('evt')
      expect(instance.isAllDay).toBe(true)
      expect(instance.endDate.getTime() - instance.startDate.getTime()).toBe(
        48 * 3600 * 1000,
      )
    }
    const ids = new Set(result.map((instance) => instance.id))
    expect(ids.size).toBe(10)
  })

  it('expands a weekly multi-BYDAY series', () => {
    const series = makeSeries({
      isAllDay: false,
      startDate: day(2024, 1, 1, 9),
      endDate: day(2024, 1, 1, 10, 30),
      rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=12',
    })
    const result = expandSeries(series, day(2024, 1, 1), day(2024, 3, 31))
    const expected = [
      day(2024, 1, 1, 9),
      day(2024, 1, 3, 9),
      day(2024, 1, 5, 9),
      day(2024, 1, 8, 9),
      day(2024, 1, 10, 9),
      day(2024, 1, 12, 9),
      day(2024, 1, 15, 9),
      day(2024, 1, 17, 9),
      day(2024, 1, 19, 9),
      day(2024, 1, 22, 9),
      day(2024, 1, 24, 9),
      day(2024, 1, 26, 9),
    ]
    expect(result).toHaveLength(12)
    expect(result.map((instance) => instance.startDate.getTime())).toEqual(
      expected.map((date) => date.getTime()),
    )
    for (const instance of result) {
      expect(instance.endDate.getTime() - instance.startDate.getTime()).toBe(
        90 * 60 * 1000,
      )
    }
  })

  it('respects INTERVAL=2', () => {
    const series = makeSeries({
      rrule: 'FREQ=DAILY;INTERVAL=2;COUNT=5',
    })
    const result = expandSeries(series, day(2024, 1, 1), day(2024, 1, 31))
    expect(result.map((instance) => instance.recurrenceId)).toEqual([
      '20240101',
      '20240103',
      '20240105',
      '20240107',
      '20240109',
    ])
  })

  it('expands a monthly BYMONTHDAY series', () => {
    const series = makeSeries({
      startDate: day(2024, 1, 15),
      rrule: 'FREQ=MONTHLY;BYMONTHDAY=15;COUNT=6',
    })
    const result = expandSeries(series, day(2024, 1, 1), day(2024, 12, 31))
    expect(result.map((instance) => instance.recurrenceId)).toEqual([
      '20240115',
      '20240215',
      '20240315',
      '20240415',
      '20240515',
      '20240615',
    ])
  })

  it('expands a monthly BYSETPOS nth-weekday series', () => {
    const series = makeSeries({
      startDate: day(2024, 1, 9),
      rrule: 'FREQ=MONTHLY;BYDAY=TU;BYSETPOS=2;COUNT=6',
    })
    const result = expandSeries(series, day(2024, 1, 1), day(2024, 12, 31))
    expect(result.map((instance) => instance.recurrenceId)).toEqual([
      '20240109',
      '20240213',
      '20240312',
      '20240409',
      '20240514',
      '20240611',
    ])
  })

  it('expands a yearly BYMONTH+BYMONTHDAY leap-day series', () => {
    const series = makeSeries({
      startDate: day(2024, 2, 29),
      rrule: 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29;COUNT=3',
    })
    const result = expandSeries(series, day(2024, 1, 1), day(2035, 1, 1))
    expect(result.map((instance) => instance.recurrenceId)).toEqual([
      '20240229',
      '20280229',
      '20320229',
    ])
  })

  it('always includes DTSTART even when it does not match the rule', () => {
    const series = makeSeries({
      isAllDay: false,
      startDate: day(2024, 1, 31, 9),
      endDate: day(2024, 1, 31, 10),
      rrule: 'FREQ=MONTHLY;BYMONTHDAY=15;COUNT=3',
    })
    const result = expandSeries(series, day(2024, 1, 1), day(2024, 4, 30))
    expect(result.map((instance) => instance.recurrenceId)).toEqual([
      '20240131T090000Z',
      '20240215T090000Z',
      '20240315T090000Z',
      '20240415T090000Z',
    ])
  })

  it('does not duplicate DTSTART when it matches the rule', () => {
    const series = makeSeries({
      rrule: 'FREQ=DAILY;COUNT=3',
    })
    const result = expandSeries(series, day(2024, 1, 1), day(2024, 1, 10))
    expect(result.map((instance) => instance.recurrenceId)).toEqual([
      '20240101',
      '20240102',
      '20240103',
    ])
  })

  it('excludes timed occurrences via EXDATE', () => {
    const series = makeSeries({
      isAllDay: false,
      startDate: day(2024, 1, 1, 12),
      endDate: day(2024, 1, 1, 13),
      rrule: 'FREQ=DAILY;COUNT=7',
      exdate: ['20240104T120000Z'],
    })
    const result = expandSeries(series, day(2024, 1, 1), day(2024, 1, 15))
    expect(result).toHaveLength(6)
    expect(
      result.some((instance) => instance.recurrenceId === '20240104T120000Z'),
    ).toBe(false)
  })

  it('excludes all-day occurrences via EXDATE date stamps', () => {
    const series = makeSeries({
      rrule: 'FREQ=DAILY;COUNT=7',
      exdate: ['20240105', '20240107'],
    })
    const result = expandSeries(series, day(2024, 1, 1), day(2024, 1, 15))
    expect(result.map((instance) => instance.recurrenceId)).toEqual([
      '20240101',
      '20240102',
      '20240103',
      '20240104',
      '20240106',
    ])
  })

  it('excludes DTSTART itself via EXDATE', () => {
    const series = makeSeries({
      isAllDay: false,
      startDate: day(2024, 1, 1, 12),
      endDate: day(2024, 1, 1, 13),
      rrule: 'FREQ=DAILY;COUNT=7',
      exdate: ['20240101T120000Z'],
    })
    const result = expandSeries(series, day(2024, 1, 1), day(2024, 1, 15))
    expect(result).toHaveLength(6)
    expect(result[0].recurrenceId).toBe('20240102T120000Z')
  })

  it('skips malformed EXDATE entries', () => {
    const series = makeSeries({
      isAllDay: false,
      startDate: day(2024, 1, 1, 12),
      endDate: day(2024, 1, 1, 13),
      rrule: 'FREQ=DAILY;COUNT=7',
      exdate: ['garbage', '20240104T120000Z'],
    })
    const result = expandSeries(series, day(2024, 1, 1), day(2024, 1, 15))
    expect(result).toHaveLength(6)
    expect(
      result.some((instance) => instance.recurrenceId === '20240104T120000Z'),
    ).toBe(false)
  })

  it('only excludes on exact stamp match', () => {
    const series = makeSeries({
      isAllDay: false,
      startDate: day(2024, 1, 1, 12),
      endDate: day(2024, 1, 1, 13),
      rrule: 'FREQ=DAILY;COUNT=7',
      exdate: ['20240104T120001Z', '20240104'],
    })
    const result = expandSeries(series, day(2024, 1, 1), day(2024, 1, 15))
    expect(result).toHaveLength(7)
  })

  it('is inclusive of both window boundaries', () => {
    const series = makeSeries({
      rrule: 'FREQ=DAILY;COUNT=3',
    })
    expect(expandSeries(series, day(2024, 1, 3), day(2024, 1, 3))).toHaveLength(
      1,
    )
    const result = expandSeries(series, day(2024, 1, 1), day(2024, 1, 10))
    expect(result.map((instance) => instance.recurrenceId)).toEqual([
      '20240101',
      '20240102',
      '20240103',
    ])
  })

  it('stops at UNTIL inclusively for date and datetime forms', () => {
    const dateUntil = makeSeries({ rrule: 'FREQ=DAILY;UNTIL=20240105' })
    expect(
      expandSeries(dateUntil, day(2024, 1, 1), day(2024, 1, 31)),
    ).toHaveLength(5)
    const timeUntil = makeSeries({
      isAllDay: false,
      startDate: day(2024, 1, 1),
      endDate: day(2024, 1, 1, 1),
      rrule: 'FREQ=DAILY;UNTIL=20240105T000000Z',
    })
    const result = expandSeries(timeUntil, day(2024, 1, 1), day(2024, 1, 31))
    expect(result.map((instance) => instance.recurrenceId)).toEqual([
      '20240101T000000Z',
      '20240102T000000Z',
      '20240103T000000Z',
      '20240104T000000Z',
      '20240105T000000Z',
    ])
  })

  it('clips to the window and returns nothing outside the series', () => {
    const series = makeSeries({
      rrule: 'FREQ=DAILY;COUNT=10',
    })
    expect(expandSeries(series, day(2024, 2, 1), day(2024, 2, 29))).toEqual([])
    expect(expandSeries(series, day(2023, 12, 1), day(2023, 12, 31))).toEqual(
      [],
    )
  })

  it('returns only occurrences inside a later window in order', () => {
    const series = makeSeries({
      startDate: day(2023, 12, 15),
      rrule: 'FREQ=DAILY',
    })
    const result = expandSeries(series, day(2023, 12, 29), day(2024, 1, 4))
    expect(result.map((instance) => instance.recurrenceId)).toEqual([
      '20231229',
      '20231230',
      '20231231',
      '20240101',
      '20240102',
      '20240103',
      '20240104',
    ])
  })

  it('returns empty for non-series events and inverted windows', () => {
    const plain = makeSeries()
    expect(expandSeries(plain, day(2024, 1, 1), day(2024, 1, 10))).toEqual([])
    const series = makeSeries({ rrule: 'FREQ=DAILY' })
    expect(expandSeries(series, day(2024, 1, 10), day(2024, 1, 1))).toEqual([])
  })

  it('caps expansion at MAX_EXPANSION by default', () => {
    const series = makeSeries({
      startDate: day(2000, 1, 1),
      rrule: 'FREQ=DAILY',
    })
    const result = expandSeries(series, day(2000, 1, 1), day(2005, 1, 1))
    expect(MAX_EXPANSION).toBe(1000)
    expect(result).toHaveLength(1000)
    expect(result[0].recurrenceId).toBe('20000101')
    const lastExpected = day(2000, 1, 1).getTime() + 999 * 86400000
    expect(result[999].recurrenceId).toBe(
      toRfcStamp(new Date(lastExpected), true),
    )
  })

  it('honours an explicit lower max', () => {
    const series = makeSeries({
      rrule: 'FREQ=DAILY',
    })
    const result = expandSeries(series, day(2024, 1, 1), day(2024, 12, 31), 5)
    expect(result.map((instance) => instance.recurrenceId)).toEqual([
      '20240101',
      '20240102',
      '20240103',
      '20240104',
      '20240105',
    ])
  })
})

describe('withUntil', () => {
  it('replaces an existing UNTIL clause in place', () => {
    const line = withUntil(
      'FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20240131T000000Z',
      '20240315',
    )
    expect(line).toBe('FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20240315T000000Z')
    expect(rruleToParts(line).until).toBe('20240315')
  })

  it('keeps the time of time-valued until stamps', () => {
    const line = withUntil(
      'FREQ=DAILY;UNTIL=20240101T120000Z',
      '20240315T120000Z',
    )
    expect(line).toBe('FREQ=DAILY;UNTIL=20240315T120000Z')
  })

  it('drops COUNT so the rule stays valid', () => {
    const line = withUntil('FREQ=WEEKLY;COUNT=10', '20240315')
    expect(line).toBe('FREQ=WEEKLY;UNTIL=20240315T000000Z')
  })

  it('limits expansion when applied to a series', () => {
    const series = makeSeries({
      startDate: day(2024, 1, 10),
      rrule: withUntil('FREQ=WEEKLY;BYDAY=WE', '20240215'),
    })
    const result = expandSeries(series, day(2024, 1, 1), day(2024, 3, 1))
    expect(result.map((instance) => instance.recurrenceId)).toEqual([
      '20240110',
      '20240117',
      '20240124',
      '20240131',
      '20240207',
      '20240214',
    ])
  })
})

describe('reanchor', () => {
  it('drops COUNT and keeps the pattern', () => {
    expect(
      reanchor('FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10', day(2024, 2, 1), true),
    ).toBe('FREQ=WEEKLY;BYDAY=MO,WE')
  })

  it('keeps UNTIL so a split never turns a bounded series infinite', () => {
    expect(
      reanchor(
        'FREQ=MONTHLY;BYMONTHDAY=15;UNTIL=20260101T000000Z',
        day(2024, 2, 1),
        true,
      ),
    ).toBe('FREQ=MONTHLY;BYMONTHDAY=15;UNTIL=20260101T000000Z')
  })

  it('keeps INTERVAL, BYMONTH and other parts', () => {
    expect(
      reanchor(
        'FREQ=YEARLY;INTERVAL=3;BYMONTH=2;BYMONTHDAY=29',
        day(2028, 2, 29),
        true,
      ),
    ).toBe('FREQ=YEARLY;INTERVAL=3;BYMONTH=2;BYMONTHDAY=29')
  })

  it('never emits DTSTART in the rule line', () => {
    for (const isAllDay of [true, false]) {
      expect(
        reanchor('FREQ=DAILY;COUNT=10', day(2024, 6, 1), isAllDay),
      ).not.toContain('DTSTART')
    }
  })

  it('supports the this-and-following split flow', () => {
    const originalRule = 'FREQ=DAILY;COUNT=10'
    const first = expandSeries(
      makeSeries({ rrule: withUntil(originalRule, '20240105') }),
      day(2024, 1, 1),
      day(2024, 1, 31),
    )
    const following = expandSeries(
      makeSeries({
        startDate: day(2024, 1, 6),
        rrule: reanchor(originalRule, day(2024, 1, 6), true),
      }),
      day(2024, 1, 1),
      day(2024, 1, 31),
    )
    expect(first.map((instance) => instance.recurrenceId)).toEqual([
      '20240101',
      '20240102',
      '20240103',
      '20240104',
      '20240105',
    ])
    expect(following[0].recurrenceId).toBe('20240106')
    const union = new Set([
      ...first.map((instance) => instance.recurrenceId),
      ...following.map((instance) => instance.recurrenceId),
    ])
    expect(union).toContain('20240101')
    expect(union).toContain('20240131')
  })
})

describe('rruleFromParts', () => {
  it('emits FREQ and INTERVAL always, null parts are omitted', () => {
    expect(rruleFromParts(makeParts({ count: 10 }))).toBe(
      'FREQ=DAILY;INTERVAL=1;COUNT=10',
    )
    expect(rruleFromParts(makeParts())).toBe('FREQ=DAILY;INTERVAL=1')
  })

  it('emits BYDAY in rule order for weekly rules', () => {
    expect(
      rruleFromParts(
        makeParts({ freq: 'WEEKLY', byweekday: ['MO', 'WE'], count: 10 }),
      ),
    ).toBe('FREQ=WEEKLY;INTERVAL=1;COUNT=10;BYDAY=MO,WE')
  })

  it('emits BYSETPOS for nth-weekday patterns', () => {
    expect(
      rruleFromParts(
        makeParts({
          freq: 'MONTHLY',
          byweekday: ['TU'],
          bysetpos: 2,
          count: 12,
        }),
      ),
    ).toBe('FREQ=MONTHLY;INTERVAL=1;COUNT=12;BYDAY=TU;BYSETPOS=2')
  })

  it('emits BYMONTHDAY and BYMONTH', () => {
    expect(
      rruleFromParts(
        makeParts({ freq: 'MONTHLY', bymonthday: [15], count: 6 }),
      ),
    ).toBe('FREQ=MONTHLY;INTERVAL=1;COUNT=6;BYMONTHDAY=15')
    expect(
      rruleFromParts(
        makeParts({ freq: 'YEARLY', bymonth: [2], bymonthday: [29] }),
      ),
    ).toBe('FREQ=YEARLY;INTERVAL=1;BYMONTHDAY=29;BYMONTH=2')
  })

  it('emits UNTIL for date and datetime stamps', () => {
    expect(rruleFromParts(makeParts({ until: '20241231' }))).toBe(
      'FREQ=DAILY;INTERVAL=1;UNTIL=20241231T000000Z',
    )
    expect(rruleFromParts(makeParts({ until: '20241231T235959Z' }))).toBe(
      'FREQ=DAILY;INTERVAL=1;UNTIL=20241231T235959Z',
    )
  })

  it('rejects until and count together', () => {
    expect(() =>
      rruleFromParts(makeParts({ until: '20241231', count: 5 })),
    ).toThrow('until and count cannot both be set')
  })

  it('rejects invalid intervals', () => {
    for (const interval of [0, -1, 1.5]) {
      expect(() => rruleFromParts(makeParts({ interval }))).toThrow(
        'interval must be a positive integer',
      )
    }
  })

  it('rejects unknown weekday names', () => {
    expect(() => rruleFromParts(makeParts({ byweekday: ['XX'] }))).toThrow(
      'Invalid weekday: XX',
    )
  })
})

describe('rruleToParts', () => {
  it('reads back a plain daily rule with defaults', () => {
    expect(rruleToParts('FREQ=DAILY')).toEqual(makeParts())
  })

  it('round-trips weekly byweekday and count', () => {
    const parts = makeParts({
      freq: 'WEEKLY',
      byweekday: ['MO', 'WE'],
      count: 10,
    })
    expect(rruleToParts(rruleFromParts(parts))).toEqual(parts)
  })

  it('round-trips monthly bysetpos', () => {
    const parts = makeParts({
      freq: 'MONTHLY',
      byweekday: ['TU'],
      bysetpos: [2],
      count: 12,
    })
    expect(rruleToParts(rruleFromParts(parts))).toEqual(parts)
  })

  it('round-trips bymonthday and bymonth', () => {
    const parts = makeParts({ freq: 'YEARLY', bymonth: [2], bymonthday: [29] })
    expect(rruleToParts(rruleFromParts(parts))).toEqual(parts)
  })

  it('round-trips until as a date stamp and as a datetime stamp', () => {
    expect(
      rruleToParts(rruleFromParts(makeParts({ until: '20241231' }))).until,
    ).toBe('20241231')
    expect(
      rruleToParts(rruleFromParts(makeParts({ until: '20241231T235959Z' })))
        .until,
    ).toBe('20241231T235959Z')
  })

  it('round-trips interval and count', () => {
    const parts = makeParts({ interval: 2, count: 5 })
    expect(rruleToParts(rruleFromParts(parts))).toEqual(parts)
  })

  it('is insensitive to attribute order in the rule string', () => {
    const byParts = rruleToParts('FREQ=WEEKLY;COUNT=10;BYDAY=MO,WE')
    expect(byParts).toEqual(rruleToParts('FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10'))
    expect(byParts).toEqual(
      makeParts({ freq: 'WEEKLY', byweekday: ['MO', 'WE'], count: 10 }),
    )
  })

  it('preserves nth-weekday prefixes (a 2MO rule is not a MO rule)', () => {
    expect(rruleToParts('FREQ=MONTHLY;BYDAY=-1FR')).toEqual(
      makeParts({ freq: 'MONTHLY', byweekday: ['-1FR'] }),
    )
    expect(rruleToParts('FREQ=MONTHLY;BYDAY=2MO')).toEqual(
      makeParts({ freq: 'MONTHLY', byweekday: ['2MO'] }),
    )
  })

  it('round-trips the RFC fields that used to be silently dropped', () => {
    const cases = [
      'FREQ=MONTHLY;BYMONTHDAY=1,15',
      'FREQ=MONTHLY;BYMONTHDAY=-1',
      'FREQ=YEARLY;BYMONTH=3,6,9,12;BYMONTHDAY=15',
      'FREQ=YEARLY;BYYEARDAY=100',
      'FREQ=YEARLY;BYWEEKNO=20;BYDAY=MO',
      'FREQ=MONTHLY;BYDAY=2MO',
      'FREQ=WEEKLY;INTERVAL=2;BYDAY=SU;WKST=SU',
      'FREQ=DAILY;BYHOUR=9,17',
      'FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1',
    ]
    for (const rule of cases) {
      // Round-tripping must not change which occurrences the rule selects:
      // parts → rule → parts is a fixed point.
      const once = rruleToParts(rule)
      const twice = rruleToParts(rruleFromParts(once))
      expect(twice).toEqual(once)
    }
  })

  it('throws on rules without FREQ', () => {
    expect(() => rruleToParts('COUNT=10')).toThrow('Invalid rule: missing FREQ')
  })

  it('round-trips a matrix of parts through the full cycle', () => {
    const matrix: RruleParts[] = [
      makeParts(),
      makeParts({
        freq: 'WEEKLY',
        interval: 2,
        byweekday: ['SU', 'TH'],
        count: 8,
      }),
      makeParts({ freq: 'MONTHLY', bymonthday: [1, -1] }),
      makeParts({ freq: 'MONTHLY', byweekday: ['SA'], bysetpos: [-1] }),
      makeParts({
        freq: 'YEARLY',
        bymonth: [1, 6, 12],
        bymonthday: [10, 20],
        until: '20271231',
      }),
      makeParts({ freq: 'MONTHLY', byweekday: ['2MO'] }),
      makeParts({ freq: 'YEARLY', byyearday: [100, -1] }),
      makeParts({ freq: 'YEARLY', byweekno: [20, -1], byweekday: ['MO'] }),
      makeParts({ freq: 'DAILY', byhour: [9, 17] }),
      makeParts({ freq: 'WEEKLY', byweekday: ['SU'], wkst: 'SU' }),
      makeParts({
        freq: 'MONTHLY',
        byweekday: ['MO', 'TU', 'WE', 'TH', 'FR'],
        bysetpos: [-1],
      }),
    ]
    for (const parts of matrix) {
      expect(rruleToParts(rruleFromParts(parts))).toEqual(parts)
    }
  })
})

describe('describeRecurrence', () => {
  it('describes a plain weekly rule (zh)', () => {
    expect(describeRecurrence('FREQ=WEEKLY;BYDAY=MO,TU', true)).toBe(
      '每周 · 周一、周二',
    )
  })

  it('describes interval + count (en)', () => {
    expect(
      describeRecurrence('FREQ=WEEKLY;INTERVAL=2;BYDAY=SU,TH;COUNT=8', false),
    ).toBe('Every 2 weeks · Thursday, Sunday · 8 times')
  })

  it('describes monthly by setpos (zh)', () => {
    expect(describeRecurrence('FREQ=MONTHLY;BYDAY=SA;BYSETPOS=-1', true)).toBe(
      '每月 · 最后一个周六',
    )
  })

  it('describes a negative bymonthday as the last day', () => {
    expect(describeRecurrence('FREQ=MONTHLY;BYMONTHDAY=-1', true)).toBe(
      '每月 · 最后一天',
    )
    expect(describeRecurrence('FREQ=MONTHLY;BYMONTHDAY=-1', false)).toBe(
      'Monthly · last day',
    )
  })

  it('describes yearly with until (en)', () => {
    expect(
      describeRecurrence(
        'FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=15;UNTIL=20271231',
        false,
      ),
    ).toBe('Yearly · Jan 15 · until 20271231')
  })

  it('falls back to the raw rule when it cannot be parsed', () => {
    expect(describeRecurrence('not-a-rule', true)).toBe('not-a-rule')
  })
})

describe('isValidRrule', () => {
  it('accepts well-formed rules', () => {
    expect(isValidRrule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TU')).toBe(true)
  })

  it('rejects empty and malformed input', () => {
    expect(isValidRrule('')).toBe(false)
    expect(isValidRrule('  ')).toBe(false)
    expect(isValidRrule('not-a-rule')).toBe(false)
    expect(isValidRrule('FREQ=;INTERVAL=2')).toBe(false)
  })
})

describe('adaptRuleToStart', () => {
  it('adds the new anchor weekday instead of discarding the others', () => {
    // A Monday rule whose anchor lands on Tuesday becomes Mon+Tue. Replacing
    // the set (the old behaviour) silently deleted every Monday occurrence.
    const adapted = adaptRuleToStart(
      'FREQ=WEEKLY;BYDAY=MO',
      day(2024, 1, 1),
      day(2024, 1, 2),
      true,
    )
    expect(adapted).toBe('FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU')
  })

  it('keeps every selected weekday of a multi-day rule', () => {
    const adapted = adaptRuleToStart(
      'FREQ=WEEKLY;BYDAY=MO,WE,FR,SU',
      day(2024, 1, 1),
      day(2024, 1, 2),
      true,
    )
    const byday = /BYDAY=([^;]+)/.exec(adapted)![1].split(',').sort()
    expect(byday).toEqual(['FR', 'MO', 'SU', 'TU', 'WE'])
  })

  it('keeps the rule untouched when the new start already matches', () => {
    const adapted = adaptRuleToStart(
      'FREQ=WEEKLY;BYDAY=MO',
      day(2024, 1, 1),
      day(2024, 1, 8),
      true,
    )
    expect(adapted).toBe('FREQ=WEEKLY;INTERVAL=1;BYDAY=MO')
  })

  it('adds the anchor day-of-month, keeping the original', () => {
    const adapted = adaptRuleToStart(
      'FREQ=MONTHLY;BYMONTHDAY=15',
      day(2024, 1, 15),
      day(2024, 1, 3),
      true,
    )
    const days = /BYMONTHDAY=([^;]+)/
      .exec(adapted)![1]
      .split(',')
      .map(Number)
      .sort((a, b) => a - b)
    expect(days).toEqual([3, 15])
  })

  it('adds the anchor as an nth-weekday instead of switching selection mode', () => {
    // 2024-02-14 is the 2nd Wednesday. The rule keeps its nth-weekday mode
    // (2nd Saturday) and gains the anchor, rather than being rewritten into a
    // BYMONTHDAY rule that drops the Saturday occurrences entirely.
    const adapted = adaptRuleToStart(
      'FREQ=MONTHLY;BYDAY=SA;BYSETPOS=2',
      day(2024, 1, 13),
      day(2024, 2, 14),
      true,
    )
    expect(adapted).toContain('BYDAY=')
    expect(adapted).toContain('SA')
    expect(adapted).toMatch(/2WE/)
    expect(adapted).not.toContain('BYMONTHDAY')
  })

  it('keeps a setpos rule when the new date still fits the pattern', () => {
    const adapted = adaptRuleToStart(
      'FREQ=MONTHLY;BYDAY=SA;BYSETPOS=2',
      day(2024, 1, 13),
      day(2024, 2, 10),
      true,
    )
    expect(adapted).toBe('FREQ=MONTHLY;INTERVAL=1;BYDAY=SA;BYSETPOS=2')
  })

  it('adds the anchor month and day to a yearly rule', () => {
    const adapted = adaptRuleToStart(
      'FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=15',
      day(2024, 1, 15),
      day(2024, 7, 2),
      true,
    )
    const months = /BYMONTH=([^;]+)/
      .exec(adapted)![1]
      .split(',')
      .map(Number)
      .sort((a, b) => a - b)
    const days = /BYMONTHDAY=([^;]+)/
      .exec(adapted)![1]
      .split(',')
      .map(Number)
      .sort((a, b) => a - b)
    expect(months).toEqual([1, 7])
    expect(days).toEqual([2, 15])
  })

  it('shifts UNTIL by the same delta when the new start passes the end', () => {
    const adapted = adaptRuleToStart(
      'FREQ=WEEKLY;BYDAY=MO;UNTIL=20240212',
      day(2024, 1, 1),
      day(2024, 2, 25),
      true,
    )
    expect(adapted).toContain('UNTIL=20240407T000000Z')
    const byday = /BYDAY=([^;]+)/.exec(adapted)![1].split(',').sort()
    expect(byday).toEqual(['MO', 'SU'])
  })

  it('returns the original rule on parse failure', () => {
    expect(
      adaptRuleToStart('garbage', day(2024, 1, 1), day(2024, 1, 2), true),
    ).toBe('garbage')
  })
})

describe('local-day anchoring', () => {
  const local = (y: number, m: number, d: number, h = 0, min = 0) =>
    new Date(y, m - 1, d, h, min)

  function localWeekday(series: RecurrenceEvent): number[] {
    return expandSeries(
      series,
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-08-31T00:00:00Z'),
    ).map((i) => i.startDate.getDay())
  }

  it('keeps a timed weekly TU at 07:00 on Tuesdays (crossing the UTC date boundary)', () => {
    const series = {
      id: 's1',
      startDate: local(2026, 7, 21, 7),
      endDate: local(2026, 7, 21, 8),
      isAllDay: false,
      rrule: 'FREQ=WEEKLY;BYDAY=TU',
      exdate: null,
    }
    const weekdays = localWeekday(series)
    expect(weekdays.slice(0, 4)).toEqual([2, 2, 2, 2])
  })

  it('emits exactly the selected weekdays for a multi-day rule', () => {
    const series = {
      id: 's2',
      startDate: local(2026, 7, 21, 7),
      endDate: local(2026, 7, 21, 8),
      isAllDay: false,
      rrule: 'FREQ=WEEKLY;BYDAY=TU,TH,FR',
      exdate: null,
    }
    const weekdays = localWeekday(series).slice(0, 6)
    expect(weekdays).toEqual([2, 4, 5, 2, 4, 5])
  })

  it('anchors at the series start then follows the selected weekdays', () => {
    const series = {
      id: 's3',
      startDate: local(2026, 7, 20, 9), // Monday, rule says TU
      endDate: local(2026, 7, 20, 10),
      isAllDay: false,
      rrule: 'FREQ=WEEKLY;BYDAY=TU',
      exdate: null,
    }
    const weekdays = localWeekday(series)
    expect(weekdays[0]).toBe(1)
    expect(weekdays.slice(1, 4)).toEqual([2, 2, 2])
  })

  it('keeps all-day occurrences on the selected local calendar day', () => {
    const series = {
      id: 's4',
      startDate: local(2026, 7, 21, 9),
      endDate: local(2026, 7, 21, 10),
      isAllDay: false,
      rrule: 'FREQ=WEEKLY;BYDAY=TU',
      exdate: null,
    }
    const weekdays = localWeekday(series)
    expect(weekdays.slice(0, 4)).toEqual([2, 2, 2, 2])
  })

  it('anchors monthly BYMONTHDAY on the local day of month', () => {
    const series = {
      id: 's5',
      startDate: local(2026, 7, 21, 7),
      endDate: local(2026, 7, 21, 8),
      isAllDay: false,
      rrule: 'FREQ=MONTHLY;BYMONTHDAY=21',
      exdate: null,
    }
    const days = expandSeries(
      series,
      new Date('2026-01-01T00:00:00Z'),
      new Date('2027-01-01T00:00:00Z'),
    ).map((i) => i.startDate.getDate())
    expect(days.slice(0, 3)).toEqual([21, 21, 21])
  })
})
