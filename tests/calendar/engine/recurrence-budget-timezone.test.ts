// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RRule } from 'rrule'
import {
  expandSeries,
  isValidRrule,
  RecurrenceBudgetError,
  wallClockToInstant,
} from '@zntr/calendar-ui/lib/recurrence/engine'

const master = {
  id: 'series',
  startDate: new Date('2026-01-06T14:00:00Z'),
  endDate: new Date('2026-01-06T15:00:00Z'),
  rrule: 'FREQ=WEEKLY;BYDAY=TU;COUNT=2',
  isAllDay: false,
  exdate: null,
}
afterEach(() => vi.restoreAllMocks())

describe('calendar dates and instants', () => {
  it('keeps Tuesday in New York, including an exact instant window', () => {
    const events = expandSeries(
      master,
      new Date('2026-01-01'),
      new Date('2026-01-20'),
      10,
      'America/New_York',
    )
    expect(events.map((e) => e.startDate.toISOString())).toEqual([
      '2026-01-06T14:00:00.000Z',
      '2026-01-13T14:00:00.000Z',
    ])
    expect(
      expandSeries(
        master,
        master.startDate,
        master.startDate,
        10,
        'America/New_York',
      ),
    ).toHaveLength(1)
  })

  it.each([
    [3, 8, 3, '2026-03-08T07:00:00.000Z'],
    // Compatible gap/fold policy: move forward in spring, earlier in autumn.
    [3, 8, 2, '2026-03-08T07:00:00.000Z'],
    [11, 1, 1, '2026-11-01T05:00:00.000Z'],
    [11, 1, 2, '2026-11-01T07:00:00.000Z'],
  ])('resolves New York %i/%i at %i:00', (month, day, hour, expected) => {
    expect(
      wallClockToInstant(
        { year: 2026, month, day, hour: 0, minute: 0, second: 0 },
        { hour, minute: 0, second: 0 },
        'America/New_York',
      ).toISOString(),
    ).toBe(expected)
  })

  it('keeps a 09:00 daily clock across DST', () => {
    const events = expandSeries(
      {
        ...master,
        startDate: new Date('2026-03-07T14:00Z'),
        endDate: new Date('2026-03-07T15:00Z'),
        rrule: 'FREQ=DAILY;COUNT=3',
      },
      new Date('2026-03-07'),
      new Date('2026-03-10'),
      10,
      'America/New_York',
    )
    expect(events.map((e) => e.startDate.toISOString())).toEqual([
      '2026-03-07T14:00:00.000Z',
      '2026-03-08T13:00:00.000Z',
      '2026-03-09T13:00:00.000Z',
    ])
  })
})

describe('recurrence work budget', () => {
  it.each([
    'FREQ=SECONDLY',
    'FREQ=MINUTELY',
    'FREQ=HOURLY',
    'FREQ=DAILY;INTERVAL=0',
    'FREQ=DAILY;INTERVAL=-1',
    'FREQ=DAILY;BYHOUR=0,1,2,3,4;BYMINUTE=0,1,2,3,4',
  ])('rejects unsupported density: %s', (rrule) => {
    expect(isValidRrule(rrule)).toBe(false)
    const iterate = vi.spyOn(RRule.prototype, 'between')
    expect(
      expandSeries(
        { ...master, rrule },
        new Date('2026-01-01'),
        new Date('2026-02-01'),
      ),
    ).toEqual([])
    expect(iterate).not.toHaveBeenCalled()
  })

  it('stops enumeration once enough visible, distinct days are found', () => {
    let visited = 0
    const original = RRule.prototype.between
    vi.spyOn(RRule.prototype, 'between').mockImplementation(
      function (after, before, inc, iterator) {
        expect(iterator).toBeTypeOf('function')
        return original.call(this, after, before, inc, (date, index) => {
          visited++
          return iterator!(date, index)
        })
      },
    )
    const events = expandSeries(
      {
        ...master,
        rrule: 'FREQ=DAILY;BYHOUR=9,17',
        exdate: ['20260106T140000Z'],
      },
      new Date('2026-01-01'),
      new Date('2027-01-01'),
      10,
      'UTC',
    )
    expect(events).toHaveLength(10)
    expect(new Set(events.map((e) => e.recurrenceId)).size).toBe(10)
    expect(visited).toBeLessThanOrEqual(22)
  })

  it('bounds even an impossible rule starting centuries before the window', () => {
    expect(() =>
      expandSeries(
        {
          ...master,
          startDate: new Date('1600-01-01'),
          rrule: 'FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30',
        },
        new Date('2026-01-01'),
        new Date('2026-02-01'),
      ),
    ).toThrow(RecurrenceBudgetError)
  })

  it('bounds rejected days for yearly rules too, even with a recent anchor', () => {
    expect(() =>
      expandSeries(
        { ...master, rrule: 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30' },
        new Date('2026-01-01'),
        new Date('2026-02-01'),
      ),
    ).toThrow(RecurrenceBudgetError)
  })

  it('allows a finite historical series to finish before the budget', () => {
    expect(
      expandSeries(
        {
          ...master,
          startDate: new Date('1800-01-01'),
          rrule: 'FREQ=DAILY;COUNT=2',
        },
        new Date('2026-01-01'),
        new Date('2026-02-01'),
      ),
    ).toEqual([])
  })
})
