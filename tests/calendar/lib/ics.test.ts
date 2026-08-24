/**
 * Pins the iCalendar (RFC 5545) format produced and consumed by import/export.
 *
 * Export bugs are silent and destructive: the user only finds out after
 * carrying the file to another calendar, where the damage cannot be undone.
 * The core guarantee is a ROUND TRIP — parse(generate(events)) returns the
 * same events — plus conformance to the specific shape agreed in CORE-152.
 */
import { describe, it, expect } from 'vitest'
import {
  collapseSeriesForExport,
  escapeIcsText,
  foldIcsLine,
  formatIcsDate,
  formatIcsDateTime,
  generateICSFile,
  parseAlarmTriggerMinutes,
  parseICS,
  parseICSDate,
  unescapeIcsText,
  type IcsEvent,
} from '@/lib/ics'

function timed(overrides: Partial<IcsEvent> = {}): IcsEvent {
  return {
    id: 'evt-1',
    title: 'Test',
    startDate: new Date(Date.UTC(2026, 7, 12, 11, 30)),
    endDate: new Date(Date.UTC(2026, 7, 12, 12, 0)),
    isAllDay: false,
    description: 'Abcd',
    location: 'Home',
    notification: 15,
    color: 'bg-[#E6F6FD]',
    calendarId: '',
    participants: [],
    ...overrides,
  }
}

describe('ics formatting primitives', () => {
  it('formats UTC datetimes and all-day dates per RFC 5545', () => {
    const d = new Date(Date.UTC(2026, 7, 12, 11, 30, 0))
    expect(formatIcsDateTime(d)).toBe('20260812T113000Z')
    expect(formatIcsDate(d)).toBe('20260812')
  })

  it('escapes and unescapes TEXT values losslessly', () => {
    const raw = 'a,b;c\\d\nnext'
    const escaped = escapeIcsText(raw)
    expect(escaped).toBe('a\\,b\\;c\\\\d\\nnext')
    expect(unescapeIcsText(escaped)).toBe(raw)
  })

  it('folds long lines at 75 octets with a leading space', () => {
    const long = `DESCRIPTION:${'x'.repeat(200)}`
    const folded = foldIcsLine(long)
    const parts = folded.split('\r\n')
    expect(parts.length).toBeGreaterThan(1)
    expect(parts[0].length).toBe(75)
    for (const part of parts.slice(1)) {
      expect(part.startsWith(' ')).toBe(true)
      expect(part.length).toBeLessThanOrEqual(75)
    }
    // Unfolding restores the original content line.
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join('')).toBe(long)
  })

  it('reads alarm triggers in minutes', () => {
    expect(parseAlarmTriggerMinutes('-PT15M')).toBe(15)
    expect(parseAlarmTriggerMinutes('-PT1H')).toBe(60)
    expect(parseAlarmTriggerMinutes('-P1D')).toBe(1440)
    expect(parseAlarmTriggerMinutes('-PT1H30M')).toBe(90)
    expect(parseAlarmTriggerMinutes('PT15M')).toBeNull()
    expect(parseAlarmTriggerMinutes('garbage')).toBeNull()
  })

  it('anchors all-day DATE values at UTC midnight so the day cannot shift', () => {
    // Local midnight would move the date by one in any non-UTC zone and break
    // the round trip (the test runner's zone is deliberately not UTC).
    expect(parseICSDate('20260812').toISOString()).toBe(
      '2026-08-12T00:00:00.000Z',
    )
  })

  it('parses UTC, offset and floating datetimes', () => {
    expect(parseICSDate('20260812T113000Z').toISOString()).toBe(
      '2026-08-12T11:30:00.000Z',
    )
    expect(parseICSDate('20260812T113000+0200').toISOString()).toBe(
      '2026-08-12T09:30:00.000Z',
    )
    // Floating time is local by definition, so compare on local parts.
    const floating = parseICSDate('20260812T113000')
    expect(floating.getHours()).toBe(11)
    expect(floating.getMinutes()).toBe(30)
  })
})

describe('generateICSFile', () => {
  it('emits the CORE-152 envelope with CRLF endings', () => {
    const ics = generateICSFile([timed()])
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    for (const line of [
      'VERSION:2.0',
      'PRODID:-//Zentra//One Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'UID:evt-1@zentra-calendar',
      'DTSTART:20260812T113000Z',
      'DTEND:20260812T120000Z',
      'SUMMARY:Test',
      'DESCRIPTION:Abcd',
      'LOCATION:Home',
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder',
      'END:VALARM',
    ]) {
      expect(ics, `missing ${line}`).toContain(`${line}\r\n`)
    }
    // DTSTAMP/CREATED/LAST-MODIFIED are present and well-formed.
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/)
    expect(ics).toMatch(/CREATED:\d{8}T\d{6}Z/)
    expect(ics).toMatch(/LAST-MODIFIED:\d{8}T\d{6}Z/)
  })

  it('never emits blank lines (the old template left empty properties)', () => {
    const ics = generateICSFile([
      timed({ description: undefined, location: undefined, notification: 0 }),
    ])
    expect(ics.split('\r\n').filter((l) => l === '').length).toBe(1) // trailing only
    expect(ics).not.toContain('DESCRIPTION:\r\n')
    expect(ics).not.toContain('LOCATION:\r\n')
    expect(ics).not.toContain('BEGIN:VALARM')
  })

  it('writes all-day events as DATE values', () => {
    const ics = generateICSFile([
      timed({
        isAllDay: true,
        startDate: new Date(Date.UTC(2026, 7, 20)),
        endDate: new Date(Date.UTC(2026, 7, 21)),
      }),
    ])
    expect(ics).toContain('DTSTART;VALUE=DATE:20260820\r\n')
    expect(ics).toContain('DTEND;VALUE=DATE:20260821\r\n')
  })

  it('writes recurrence rules and exdates, normalising a stored prefix', () => {
    const ics = generateICSFile([
      timed({
        rrule: 'FREQ=WEEKLY;BYDAY=MO',
        exdate: ['20260817T113000Z'],
      }),
    ])
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO\r\n')
    expect(ics).toContain('EXDATE:20260817T113000Z\r\n')

    // A stored rule that already carries the prefix must not double it.
    const prefixed = generateICSFile([timed({ rrule: 'RRULE:FREQ=DAILY' })])
    expect(prefixed).toContain('RRULE:FREQ=DAILY\r\n')
    expect(prefixed).not.toContain('RRULE:RRULE:')
  })

  it('tags date-only exdates as DATE values to match an all-day DTSTART', () => {
    const ics = generateICSFile([
      timed({
        isAllDay: true,
        startDate: new Date(Date.UTC(2026, 7, 20)),
        endDate: new Date(Date.UTC(2026, 7, 21)),
        rrule: 'FREQ=DAILY',
        exdate: ['20260822'],
      }),
    ])
    expect(ics).toContain('EXDATE;VALUE=DATE:20260822\r\n')
  })
})

describe('parseICS', () => {
  it('round-trips a timed event through generate → parse', () => {
    const original = timed({
      title: 'Test, with comma; and semicolon',
      description: 'Line one\nLine two, with comma',
      location: 'Room A; Floor 2',
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
      exdate: ['20260817T113000Z'],
      notification: 15,
    })
    const [back] = parseICS(generateICSFile([original]))

    expect(back.id).toBe(original.id)
    expect(back.title).toBe(original.title)
    expect(back.description).toBe(original.description)
    expect(back.location).toBe(original.location)
    expect(back.isAllDay).toBe(false)
    expect(back.notification).toBe(15)
    expect(back.rrule).toBe('FREQ=WEEKLY;BYDAY=MO')
    expect(back.exdate).toEqual(['20260817T113000Z'])
    expect(new Date(back.startDate).toISOString()).toBe(
      new Date(original.startDate).toISOString(),
    )
    expect(new Date(back.endDate).toISOString()).toBe(
      new Date(original.endDate).toISOString(),
    )
  })

  it('round-trips an all-day event without shifting the date', () => {
    const original = timed({
      id: 'all-1',
      isAllDay: true,
      startDate: new Date(Date.UTC(2026, 7, 20)),
      endDate: new Date(Date.UTC(2026, 7, 21)),
      description: undefined,
      location: undefined,
      notification: 0,
    })
    const [back] = parseICS(generateICSFile([original]))
    expect(back.isAllDay).toBe(true)
    expect(new Date(back.startDate).toISOString()).toBe(
      '2026-08-20T00:00:00.000Z',
    )
    expect(new Date(back.endDate).toISOString()).toBe(
      '2026-08-21T00:00:00.000Z',
    )
  })

  it('round-trips a long folded description', () => {
    const long = `${'word '.repeat(60)}end`
    const [back] = parseICS(generateICSFile([timed({ description: long })]))
    expect(back.description).toBe(long)
  })

  it('round-trips several events at once', () => {
    const events = [
      timed({ id: 'a' }),
      timed({
        id: 'b',
        isAllDay: true,
        startDate: new Date(Date.UTC(2026, 8, 1)),
        endDate: new Date(Date.UTC(2026, 8, 2)),
      }),
      timed({ id: 'c', notification: 0, description: undefined }),
    ]
    const back = parseICS(generateICSFile(events))
    expect(back.map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })

  it('keeps a VALARM description out of the event', () => {
    const [back] = parseICS(generateICSFile([timed({ description: 'Abcd' })]))
    expect(back.description).toBe('Abcd')
    expect(back.notification).toBe(15)
  })

  it('parses the reference file from the issue', () => {
    const reference = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Zentra//One Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:72d21ead-a162-48b7-9c5c-46817c205e37@zentra-calendar',
      'DTSTAMP:20260812T092945Z',
      'CREATED:20260812T092945Z',
      'LAST-MODIFIED:20260812T092945Z',
      'DTSTART:20260812T113000Z',
      'DTEND:20260812T120000Z',
      'SUMMARY:Test',
      'DESCRIPTION:Abcd',
      'LOCATION:Home',
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    const [back] = parseICS(reference)
    expect(back.id).toBe('72d21ead-a162-48b7-9c5c-46817c205e37')
    expect(back.title).toBe('Test')
    expect(back.description).toBe('Abcd')
    expect(back.location).toBe('Home')
    expect(back.notification).toBe(15)
    expect(new Date(back.startDate).toISOString()).toBe(
      '2026-08-12T11:30:00.000Z',
    )
  })

  it('drops events without a usable start and defaults a missing end', () => {
    const noStart = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:x',
      'SUMMARY:No start',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:y',
      'SUMMARY:No end',
      'DTSTART:20260812T113000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const back = parseICS(noStart)
    expect(back).toHaveLength(1)
    expect(back[0].id).toBe('y')
    // Missing DTEND falls back to start + 1h.
    expect(new Date(back[0].endDate).toISOString()).toBe(
      '2026-08-12T12:30:00.000Z',
    )
  })

  it('uses the supplied fallback title for untitled events', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:z',
      'DTSTART:20260812T113000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const [back] = parseICS(ics, { fallbackTitle: '未命名日程' })
    expect(back.title).toBe('未命名日程')
  })
})

describe('recurring series export (CORE-152 regression)', () => {
  /**
   * The store holds a recurring series as N expanded occurrences, each
   * inheriting the master's rrule. Exporting them verbatim produced N VEVENTs
   * that each carried the full RRULE, so an importing calendar re-expanded
   * every one into the whole series and the user saw the same event repeated —
   * the "每个日程都是一样的" report.
   */
  function occurrence(
    stamp: string,
    start: Date,
    overrides: Partial<IcsEvent> = {},
  ): IcsEvent {
    return {
      id: `m1_${stamp}`,
      seriesId: 'm1',
      recurrenceId: stamp,
      title: 'Standup',
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
      startDate: start,
      endDate: new Date(start.getTime() + 60 * 60 * 1000),
      isAllDay: false,
      notification: 0,
      ...overrides,
    }
  }

  const series = [
    occurrence('20260803T090000Z', new Date(Date.UTC(2026, 7, 3, 9))),
    occurrence('20260810T090000Z', new Date(Date.UTC(2026, 7, 10, 9))),
    occurrence('20260817T090000Z', new Date(Date.UTC(2026, 7, 17, 9))),
  ]

  it('collapses expanded occurrences into a single anchor', () => {
    const collapsed = collapseSeriesForExport(series)
    expect(collapsed).toHaveLength(1)
    // The anchor must be the EARLIEST occurrence, or the rule regenerates a
    // different set.
    expect(new Date(collapsed[0].startDate).toISOString()).toBe(
      '2026-08-03T09:00:00.000Z',
    )
  })

  it('keeps the anchor even when occurrences arrive out of order', () => {
    const shuffled = [series[2], series[0], series[1]]
    const collapsed = collapseSeriesForExport(shuffled)
    expect(collapsed).toHaveLength(1)
    expect(new Date(collapsed[0].startDate).toISOString()).toBe(
      '2026-08-03T09:00:00.000Z',
    )
  })

  it('writes ONE VEVENT with ONE RRULE for the whole series', () => {
    const ics = generateICSFile(series)
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(1)
    expect((ics.match(/^RRULE:/gm) ?? []).length).toBe(1)
    expect(ics).toContain('DTSTART:20260803T090000Z')
    // All occurrences share the series UID, not their instance ids.
    expect(ics).toContain('UID:m1@zentra-calendar')
    expect(ics).not.toContain('m1_20260810T090000Z@zentra-calendar')
  })

  it('does not merge distinct series or plain events', () => {
    const mixed = [
      ...series,
      occurrence('20260804T140000Z', new Date(Date.UTC(2026, 7, 4, 14)), {
        id: 'm2_20260804T140000Z',
        seriesId: 'm2',
        title: 'Other series',
      }),
      {
        id: 'plain-1',
        title: 'One-off',
        startDate: new Date(Date.UTC(2026, 7, 5, 10)),
        endDate: new Date(Date.UTC(2026, 7, 5, 11)),
      } as IcsEvent,
    ]
    const ics = generateICSFile(mixed)
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(3)
    const summaries = [...ics.matchAll(/^SUMMARY:(.*)$/gm)].map((m) =>
      m[1].trim(),
    )
    expect(summaries.sort()).toEqual(['One-off', 'Other series', 'Standup'])
  })

  it('emits a single-instance edit as a RECURRENCE-ID override without its own rule', () => {
    const withOverride = [
      ...series,
      occurrence('20260824T090000Z', new Date(Date.UTC(2026, 7, 24, 15)), {
        id: 'ovr-1',
        isOverride: true,
        title: 'Standup (moved)',
      }),
    ]
    const ics = generateICSFile(withOverride)
    // Anchor + override.
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2)
    // Only the anchor recurs.
    expect((ics.match(/^RRULE:/gm) ?? []).length).toBe(1)
    expect(ics).toContain('RECURRENCE-ID:20260824T090000Z')
    // The override shares the parent UID so calendars link them.
    expect((ics.match(/^UID:m1@zentra-calendar/gm) ?? []).length).toBe(2)
  })

  it('round-trips the collapsed series back to one recurring event', () => {
    const parsed = parseICS(generateICSFile(series))
    expect(parsed).toHaveLength(1)
    expect(parsed[0].rrule).toBe('FREQ=WEEKLY;BYDAY=MO')
    expect(new Date(parsed[0].startDate).toISOString()).toBe(
      '2026-08-03T09:00:00.000Z',
    )
  })

  it('round-trips an override as an override', () => {
    const withOverride = [
      series[0],
      occurrence('20260824T090000Z', new Date(Date.UTC(2026, 7, 24, 15)), {
        id: 'ovr-1',
        isOverride: true,
      }),
    ]
    const parsed = parseICS(generateICSFile(withOverride))
    expect(parsed).toHaveLength(2)
    const override = parsed.find((e) => e.isOverride)
    expect(override).toBeDefined()
    expect(override?.recurrenceId).toBe('20260824T090000Z')
    expect(override?.rrule).toBeNull()
  })

  it('keeps EXDATEs on the anchor only', () => {
    const withExdate = series.map((e) => ({
      ...e,
      exdate: ['20260831T090000Z'],
    }))
    const ics = generateICSFile(withExdate)
    expect((ics.match(/^EXDATE/gm) ?? []).length).toBe(1)
  })
})
