import { describe, it, expect } from 'vitest'
import {
  formatSelectionRange,
  defaultCreateRange,
  clampRangeToDay,
  selectionCoversDay,
} from '@/components/app/views/selection-range'

describe('formatSelectionRange', () => {
  const formatHourMinute = (hour: number, minute: number) =>
    `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`

  it('formats selection range with start before end', () => {
    const result = formatSelectionRange(540, 600, formatHourMinute)
    expect(result).toBe('09:00 - 10:00')
  })

  it('normalizes when start is after end', () => {
    const result = formatSelectionRange(600, 540, formatHourMinute)
    expect(result).toBe('09:00 - 10:00')
  })

  it('handles midnight crossing', () => {
    const result = formatSelectionRange(1380, 1440, formatHourMinute)
    expect(result).toBe('23:00 - 24:00')
  })

  it('handles same start and end', () => {
    const result = formatSelectionRange(540, 540, formatHourMinute)
    expect(result).toBe('09:00 - 09:00')
  })

  it('handles 12h format function', () => {
    const format12h = (hour: number, minute: number) => {
      const period = hour >= 12 ? 'PM' : 'AM'
      const twelveHour = hour % 12 || 12
      return `${twelveHour}:${minute.toString().padStart(2, '0')} ${period}`
    }
    const result = formatSelectionRange(540, 780, format12h)
    expect(result).toBe('9:00 AM - 1:00 PM')
  })

  it('handles zero minutes', () => {
    const result = formatSelectionRange(0, 30, formatHourMinute)
    expect(result).toBe('00:00 - 00:30')
  })
})

describe('defaultCreateRange', () => {
  it('spans 30 minutes from the start', () => {
    const start = new Date('2026-08-23T10:00:00')
    const { end } = defaultCreateRange(start)
    expect(end.getTime() - start.getTime()).toBe(30 * 60000)
  })

  it('clamps to the end of the day when 30 minutes would cross midnight', () => {
    // Creating at 23:40 must not produce a range spilling into the next day:
    // the blue anchor box lives on the start day, and on the last day of the
    // visible period the spill-over day is not even rendered.
    const start = new Date('2026-08-23T23:40:00')
    const { end } = defaultCreateRange(start)
    expect(end.getDate()).toBe(23)
    expect(end.getHours()).toBe(23)
    expect(end.getMinutes()).toBe(59)
  })

  it('keeps a range ending exactly at 23:59 intact', () => {
    const start = new Date('2026-08-23T23:29:00')
    const { end } = defaultCreateRange(start)
    expect(end.getHours()).toBe(23)
    expect(end.getMinutes()).toBe(59)
  })
})

describe('clampRangeToDay', () => {
  const day = new Date(2026, 7, 24) // Mon Aug 24 2026

  it('returns the raw minutes for a same-day range', () => {
    const slice = clampRangeToDay(
      {
        start: new Date(2026, 7, 24, 9, 0),
        end: new Date(2026, 7, 24, 10, 30),
      },
      day,
    )
    expect(slice).toEqual({ startMinute: 540, endMinute: 630 })
  })

  it('returns null when the range does not touch the day', () => {
    const slice = clampRangeToDay(
      {
        start: new Date(2026, 7, 26, 9, 0),
        end: new Date(2026, 7, 26, 10, 0),
      },
      day,
    )
    expect(slice).toBeNull()
  })

  it('clamps a multi-day range on its middle day to the full day', () => {
    const slice = clampRangeToDay(
      {
        start: new Date(2026, 7, 23, 15, 0),
        end: new Date(2026, 7, 25, 11, 0),
      },
      day,
    )
    expect(slice).toEqual({ startMinute: 0, endMinute: 24 * 60 })
  })

  it('clamps only the tail on the start day', () => {
    const slice = clampRangeToDay(
      {
        start: new Date(2026, 7, 24, 15, 0),
        end: new Date(2026, 7, 26, 11, 0),
      },
      day,
    )
    expect(slice).toEqual({ startMinute: 900, endMinute: 24 * 60 })
  })

  it('clamps only the head on the end day', () => {
    const slice = clampRangeToDay(
      {
        start: new Date(2026, 7, 22, 15, 0),
        end: new Date(2026, 7, 24, 11, 0),
      },
      day,
    )
    expect(slice).toEqual({ startMinute: 0, endMinute: 660 })
  })

  it('tolerates an inverted range', () => {
    const slice = clampRangeToDay(
      {
        start: new Date(2026, 7, 24, 10, 30),
        end: new Date(2026, 7, 24, 9, 0),
      },
      day,
    )
    expect(slice).toEqual({ startMinute: 540, endMinute: 630 })
  })

  it('returns null for invalid dates', () => {
    expect(
      clampRangeToDay(
        { start: new Date('invalid'), end: new Date(2026, 7, 24, 10, 0) },
        day,
      ),
    ).toBeNull()
  })

  it('keeps a zero-length range on its own day', () => {
    const at = new Date(2026, 7, 24, 9, 0)
    expect(clampRangeToDay({ start: at, end: at }, day)).toEqual({
      startMinute: 540,
      endMinute: 540,
    })
    expect(
      clampRangeToDay({ start: at, end: at }, new Date(2026, 7, 25)),
    ).toBeNull()
  })

  it('excludes a range ending exactly at the day boundary midnight', () => {
    // Ends 24th 00:00 — occupies the 23rd only.
    const slice = clampRangeToDay(
      {
        start: new Date(2026, 7, 23, 22, 0),
        end: new Date(2026, 7, 24, 0, 0),
      },
      day,
    )
    expect(slice).toBeNull()
  })
})

describe('selectionCoversDay', () => {
  it('covers every day of a range spanning a whole period and beyond', () => {
    // Spans from the previous week into the next month.
    const range = {
      start: new Date(2026, 7, 19, 8, 0),
      end: new Date(2026, 8, 2, 18, 0),
    }
    expect(selectionCoversDay(range, new Date(2026, 7, 19))).toBe(true)
    expect(selectionCoversDay(range, new Date(2026, 7, 24))).toBe(true)
    expect(selectionCoversDay(range, new Date(2026, 8, 2))).toBe(true)
    expect(selectionCoversDay(range, new Date(2026, 8, 3))).toBe(false)
    expect(selectionCoversDay(range, new Date(2026, 7, 18))).toBe(false)
  })
})
