import { describe, expect, it } from 'vitest'
import {
  findFreeSlots,
  mergeBusyIntervals,
  timezoneOffsetMs,
} from '@zntr/agent/scheduling'

const HOUR = 3_600_000
const DAY = 24 * HOUR

// A fixed Monday 00:00 UTC anchor keeps hour arithmetic readable.
const day0 = Date.UTC(2026, 8, 7) // 2026-09-07 (Monday)

describe('mergeBusyIntervals', () => {
  it('merges overlapping and adjacent intervals', () => {
    const merged = mergeBusyIntervals([
      { startMs: 10, endMs: 20 },
      { startMs: 15, endMs: 30 },
      { startMs: 30, endMs: 40 },
      { startMs: 50, endMs: 60 },
    ])
    expect(merged).toEqual([
      { startMs: 10, endMs: 40 },
      { startMs: 50, endMs: 60 },
    ])
  })

  it('drops empty/inverted intervals and sorts', () => {
    const merged = mergeBusyIntervals([
      { startMs: 50, endMs: 60 },
      { startMs: 20, endMs: 20 },
      { startMs: 30, endMs: 10 },
      { startMs: 0, endMs: 5 },
    ])
    expect(merged).toEqual([
      { startMs: 0, endMs: 5 },
      { startMs: 50, endMs: 60 },
    ])
  })
})

describe('findFreeSlots', () => {
  it('returns the whole window when nothing is busy (no hour clamp)', () => {
    const slots = findFreeSlots({
      windowStartMs: day0,
      windowEndMs: day0 + 4 * HOUR,
      busy: [],
      minDurationMinutes: 30,
    })
    expect(slots).toEqual([
      { startMs: day0, endMs: day0 + 4 * HOUR, durationMinutes: 240 },
    ])
  })

  it('finds gaps between busy intervals', () => {
    const slots = findFreeSlots({
      windowStartMs: day0 + 9 * HOUR,
      windowEndMs: day0 + 18 * HOUR,
      busy: [
        { startMs: day0 + 10 * HOUR, endMs: day0 + 11 * HOUR },
        { startMs: day0 + 14 * HOUR, endMs: day0 + 15 * HOUR },
      ],
      minDurationMinutes: 60,
    })
    expect(slots).toEqual([
      {
        startMs: day0 + 9 * HOUR,
        endMs: day0 + 10 * HOUR,
        durationMinutes: 60,
      },
      {
        startMs: day0 + 11 * HOUR,
        endMs: day0 + 14 * HOUR,
        durationMinutes: 180,
      },
      {
        startMs: day0 + 15 * HOUR,
        endMs: day0 + 18 * HOUR,
        durationMinutes: 180,
      },
    ])
  })

  it('filters gaps shorter than the minimum duration', () => {
    const slots = findFreeSlots({
      windowStartMs: day0,
      windowEndMs: day0 + 2 * HOUR,
      busy: [{ startMs: day0 + 30 * 60_000, endMs: day0 + HOUR }],
      minDurationMinutes: 45,
    })
    expect(slots).toEqual([
      { startMs: day0 + HOUR, endMs: day0 + 2 * HOUR, durationMinutes: 60 },
    ])
  })

  it('clamps slots to working hours and splits across days', () => {
    const slots = findFreeSlots({
      windowStartMs: day0,
      windowEndMs: day0 + 2 * DAY,
      busy: [],
      minDurationMinutes: 60,
      dayStartHourUtc: 9,
      dayEndHourUtc: 18,
    })
    expect(slots).toEqual([
      {
        startMs: day0 + 9 * HOUR,
        endMs: day0 + 18 * HOUR,
        durationMinutes: 540,
      },
      {
        startMs: day0 + DAY + 9 * HOUR,
        endMs: day0 + DAY + 18 * HOUR,
        durationMinutes: 540,
      },
    ])
  })

  it('respects maxSlots', () => {
    const slots = findFreeSlots({
      windowStartMs: day0,
      windowEndMs: day0 + 5 * DAY,
      busy: [],
      minDurationMinutes: 60,
      dayStartHourUtc: 9,
      dayEndHourUtc: 18,
      maxSlots: 2,
    })
    expect(slots).toHaveLength(2)
  })

  it('ignores busy intervals entirely outside the window', () => {
    const slots = findFreeSlots({
      windowStartMs: day0 + 10 * HOUR,
      windowEndMs: day0 + 12 * HOUR,
      busy: [
        { startMs: day0, endMs: day0 + HOUR },
        { startMs: day0 + 20 * HOUR, endMs: day0 + 21 * HOUR },
      ],
      minDurationMinutes: 30,
    })
    expect(slots).toEqual([
      {
        startMs: day0 + 10 * HOUR,
        endMs: day0 + 12 * HOUR,
        durationMinutes: 120,
      },
    ])
  })

  it('returns empty for an inverted window', () => {
    expect(
      findFreeSlots({
        windowStartMs: day0 + HOUR,
        windowEndMs: day0,
        busy: [],
        minDurationMinutes: 15,
      }),
    ).toEqual([])
  })

  it('handles a busy interval covering the whole window', () => {
    expect(
      findFreeSlots({
        windowStartMs: day0 + 10 * HOUR,
        windowEndMs: day0 + 12 * HOUR,
        busy: [{ startMs: day0, endMs: day0 + DAY }],
        minDurationMinutes: 15,
      }),
    ).toEqual([])
  })
})

describe('timezoneOffsetMs', () => {
  it('is zero for UTC', () => {
    expect(timezoneOffsetMs(new Date(day0), 'UTC')).toBe(0)
  })

  it('is +8h for Asia/Shanghai (no DST)', () => {
    expect(timezoneOffsetMs(new Date(day0), 'Asia/Shanghai')).toBe(8 * HOUR)
  })

  it('is negative for America/New_York in September (EDT, -4h)', () => {
    expect(timezoneOffsetMs(new Date(day0), 'America/New_York')).toBe(-4 * HOUR)
  })
})
