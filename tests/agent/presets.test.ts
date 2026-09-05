import { describe, expect, it } from 'vitest'
import {
  normalizePreset,
  resolvePreset,
  PRESET_NAMES,
} from '@zntr/agent/presets'

// Friday 2026-09-04 15:30 UTC — a fixed instant keeps boundaries exact.
const now = new Date(Date.UTC(2026, 8, 4, 15, 30))

describe('normalizePreset', () => {
  it('accepts every canonical name', () => {
    for (const name of PRESET_NAMES) {
      expect(normalizePreset(name)).toBe(name)
    }
  })

  it('normalizes case, whitespace and dashes', () => {
    expect(normalizePreset(' This-Week ')).toBe('this_week')
    expect(normalizePreset('TOMORROW')).toBe('tomorrow')
  })

  it('maps aliases onto canonical names', () => {
    expect(normalizePreset('week')).toBe('this_week')
    expect(normalizePreset('month')).toBe('this_month')
    expect(normalizePreset('future')).toBe('upcoming')
    expect(normalizePreset('previous_week')).toBe('last_week')
  })

  it('returns null for junk', () => {
    expect(normalizePreset('sometime_soon')).toBeNull()
    expect(normalizePreset('')).toBeNull()
  })
})

describe('resolvePreset (UTC)', () => {
  it('today spans the local day', () => {
    expect(resolvePreset('today', now, 'UTC')).toEqual({
      start: '2026-09-04T00:00:00.000Z',
      end: '2026-09-05T00:00:00.000Z',
    })
  })

  it('tomorrow and yesterday shift by one day', () => {
    expect(resolvePreset('tomorrow', now, 'UTC')).toEqual({
      start: '2026-09-05T00:00:00.000Z',
      end: '2026-09-06T00:00:00.000Z',
    })
    expect(resolvePreset('yesterday', now, 'UTC')).toEqual({
      start: '2026-09-03T00:00:00.000Z',
      end: '2026-09-04T00:00:00.000Z',
    })
  })

  it('weeks start on Monday', () => {
    // 2026-09-04 is a Friday; that week's Monday is 08-31.
    expect(resolvePreset('this_week', now, 'UTC')).toEqual({
      start: '2026-08-31T00:00:00.000Z',
      end: '2026-09-07T00:00:00.000Z',
    })
    expect(resolvePreset('next_week', now, 'UTC')).toEqual({
      start: '2026-09-07T00:00:00.000Z',
      end: '2026-09-14T00:00:00.000Z',
    })
    expect(resolvePreset('last_week', now, 'UTC')).toEqual({
      start: '2026-08-24T00:00:00.000Z',
      end: '2026-08-31T00:00:00.000Z',
    })
  })

  it('months use calendar boundaries', () => {
    expect(resolvePreset('this_month', now, 'UTC')).toEqual({
      start: '2026-09-01T00:00:00.000Z',
      end: '2026-10-01T00:00:00.000Z',
    })
    expect(resolvePreset('last_month', now, 'UTC')).toEqual({
      start: '2026-08-01T00:00:00.000Z',
      end: '2026-09-01T00:00:00.000Z',
    })
    expect(resolvePreset('next_month', now, 'UTC')).toEqual({
      start: '2026-10-01T00:00:00.000Z',
      end: '2026-11-01T00:00:00.000Z',
    })
  })

  it('upcoming/past are open-ended at now', () => {
    expect(resolvePreset('upcoming', now, 'UTC')).toEqual({
      start: now.toISOString(),
    })
    expect(resolvePreset('past', now, 'UTC')).toEqual({
      end: now.toISOString(),
    })
  })
})

describe('resolvePreset (timezones)', () => {
  it('today follows the local wall clock, not UTC', () => {
    // 15:30 UTC on 09-04 is 23:30 in Shanghai (+8) — still 09-04 locally,
    // but local midnight is 16:00 UTC the previous day.
    expect(resolvePreset('today', now, 'Asia/Shanghai')).toEqual({
      start: '2026-09-03T16:00:00.000Z',
      end: '2026-09-04T16:00:00.000Z',
    })
  })

  it('a late-UTC instant can already be tomorrow locally', () => {
    const lateUtc = new Date(Date.UTC(2026, 8, 4, 20, 0)) // 04:00 on 09-05 in Shanghai
    expect(resolvePreset('today', lateUtc, 'Asia/Shanghai')).toEqual({
      start: '2026-09-04T16:00:00.000Z',
      end: '2026-09-05T16:00:00.000Z',
    })
  })
})
