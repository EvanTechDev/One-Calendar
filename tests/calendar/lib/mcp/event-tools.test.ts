import { describe, it, expect } from 'vitest'
import {
  resolveTimeRange,
  normalizeEmails,
  colorCandidates,
  isValidEventColor,
  validatePagination,
  validateEventFields,
  projectEventFields,
  extractParticipantEmails,
  matchesParticipantFilter,
  InvalidEventQueryError,
} from '@/lib/mcp/event-tools'

describe('resolveTimeRange', () => {
  it('returns empty range for no time filter', () => {
    expect(resolveTimeRange(undefined, 'UTC')).toEqual({})
  })

  it('parses explicit start and end dates', () => {
    const range = resolveTimeRange(
      { start: '2026-09-01T00:00:00Z', end: '2026-10-01T00:00:00Z' },
      'UTC',
    )
    expect(range.start?.toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(range.end?.toISOString()).toBe('2026-10-01T00:00:00.000Z')
  })

  it('rejects invalid date strings', () => {
    expect(() => resolveTimeRange({ start: 'not-a-date' }, 'UTC')).toThrowError(
      InvalidEventQueryError,
    )
  })

  it('rejects preset combined with explicit bounds', () => {
    expect(() =>
      resolveTimeRange(
        { preset: 'today', start: '2026-09-01T00:00:00Z' },
        'UTC',
      ),
    ).toThrow(/cannot be combined/)
  })

  it('computes today in the given timezone', () => {
    const now = new Date('2026-08-15T12:00:00Z')
    const range = resolveTimeRange({ preset: 'today', now }, 'UTC')
    expect(range.start?.toISOString()).toBe('2026-08-15T00:00:00.000Z')
    expect(range.end?.toISOString()).toBe('2026-08-16T00:00:00.000Z')
  })

  it('computes today in a non-UTC timezone', () => {
    const now = new Date('2026-08-15T12:00:00Z')
    const range = resolveTimeRange(
      { preset: 'today', timezone: 'Asia/Shanghai', now },
      'UTC',
    )
    expect(range.start?.toISOString()).toBe('2026-08-14T16:00:00.000Z')
    expect(range.end?.toISOString()).toBe('2026-08-15T16:00:00.000Z')
  })

  it('computes this_week starting on Monday', () => {
    const now = new Date('2026-08-15T12:00:00Z')
    const range = resolveTimeRange({ preset: 'this_week', now }, 'UTC')
    expect(range.start?.toISOString()).toBe('2026-08-10T00:00:00.000Z')
    expect(range.end?.toISOString()).toBe('2026-08-17T00:00:00.000Z')
  })

  it('computes next_week', () => {
    const now = new Date('2026-08-15T12:00:00Z')
    const range = resolveTimeRange({ preset: 'next_week', now }, 'UTC')
    expect(range.start?.toISOString()).toBe('2026-08-17T00:00:00.000Z')
    expect(range.end?.toISOString()).toBe('2026-08-24T00:00:00.000Z')
  })

  it('upcoming starts now with no end', () => {
    const now = new Date('2026-08-15T12:00:00Z')
    const range = resolveTimeRange({ preset: 'upcoming', now }, 'UTC')
    expect(range.start?.toISOString()).toBe('2026-08-15T12:00:00.000Z')
    expect(range.end).toBeUndefined()
  })

  it('past ends now with no start', () => {
    const now = new Date('2026-08-15T12:00:00Z')
    const range = resolveTimeRange({ preset: 'past', now }, 'UTC')
    expect(range.end?.toISOString()).toBe('2026-08-15T12:00:00.000Z')
    expect(range.start).toBeUndefined()
  })

  it('rejects invalid timezones for presets', () => {
    expect(() =>
      resolveTimeRange({ preset: 'today', timezone: 'Not/AZone' }, 'UTC'),
    ).toThrow(/Invalid timezone/)
  })
})

describe('normalizeEmails', () => {
  it('lowercases, trims and dedupes emails', () => {
    expect(normalizeEmails([' A@B.com ', 'a@b.com', 'c@d.com'])).toEqual([
      'a@b.com',
      'c@d.com',
    ])
  })

  it('rejects invalid emails', () => {
    expect(() => normalizeEmails(['not-an-email'])).toThrowError(
      InvalidEventQueryError,
    )
  })
})

describe('colorCandidates / isValidEventColor', () => {
  it('includes name, hex and stored-value candidates', () => {
    expect(colorCandidates('blue')).toContain('bg-[#E6F6FD]')
    expect(colorCandidates('#3B82F6')).toContain('bg-[#E6F6FD]')
    expect(colorCandidates('bg-blue-500')).toContain('bg-[#E6F6FD]')
    expect(colorCandidates('bg-[#E6F6FD]')).toContain('bg-[#E6F6FD]')
  })

  it('accepts names, hexes, palette and event-style values', () => {
    expect(isValidEventColor('blue')).toBe(true)
    expect(isValidEventColor('#3B82F6')).toBe(true)
    expect(isValidEventColor('bg-blue-500')).toBe(true)
    expect(isValidEventColor('bg-[#E6F6FD]')).toBe(true)
  })

  it('rejects unknown colors', () => {
    expect(isValidEventColor('rainbow')).toBe(false)
    expect(isValidEventColor('bg-rainbow-500')).toBe(false)
  })
})

describe('validatePagination', () => {
  it('defaults page to 1 and limit to fallback', () => {
    expect(validatePagination(undefined, undefined)).toEqual({
      page: 1,
      limit: 50,
    })
  })

  it('accepts valid values', () => {
    expect(validatePagination(2, 25)).toEqual({ page: 2, limit: 25 })
  })

  it('rejects page below 1', () => {
    expect(() => validatePagination(0, 10)).toThrowError(InvalidEventQueryError)
  })

  it('rejects limit above the cap', () => {
    expect(() => validatePagination(1, 101)).toThrow(/between 1 and 100/)
  })

  it('rejects non-integers', () => {
    expect(() => validatePagination(1.5, 10)).toThrowError(
      InvalidEventQueryError,
    )
  })
})

describe('fields projection', () => {
  const event = {
    id: 'evt-1',
    title: 'Standup',
    startDate: '2026-08-15T09:00:00Z',
    color: 'bg-[#E6F6FD]',
    categoryId: 'cat-1',
  }

  it('rejects unknown fields', () => {
    expect(() => validateEventFields(['nope'])).toThrow(/Unknown field: nope/)
  })

  it('returns the full event when no fields requested', () => {
    expect(projectEventFields(event)).toEqual(event)
  })

  it('projects only requested fields and always keeps id', () => {
    expect(projectEventFields(event, ['title'])).toEqual({
      id: 'evt-1',
      title: 'Standup',
    })
  })
})

describe('participant matching', () => {
  it('extracts emails from string and object entries', () => {
    expect(
      extractParticipantEmails([
        'alice@example.com',
        { email: 'Bob@Example.com', name: 'Bob' },
        { name: 'No Email' },
      ]),
    ).toEqual(['alice@example.com', 'bob@example.com'])
  })

  it('matches any mode', () => {
    const emails = new Set(['a@x.com', 'b@x.com'])
    expect(
      matchesParticipantFilter(emails, { emails: ['c@x.com', 'a@x.com'] }),
    ).toBe(true)
  })

  it('matches all mode', () => {
    const emails = new Set(['a@x.com', 'b@x.com'])
    expect(
      matchesParticipantFilter(emails, {
        emails: ['a@x.com', 'b@x.com'],
        mode: 'all',
      }),
    ).toBe(true)
    expect(
      matchesParticipantFilter(emails, {
        emails: ['a@x.com', 'c@x.com'],
        mode: 'all',
      }),
    ).toBe(false)
  })

  it('matches exists true/false', () => {
    expect(
      matchesParticipantFilter(new Set(['a@x.com']), { exists: true }),
    ).toBe(true)
    expect(matchesParticipantFilter(new Set(), { exists: true })).toBe(false)
    expect(matchesParticipantFilter(new Set(), { exists: false })).toBe(true)
  })

  it('returns true when no filter is given', () => {
    expect(matchesParticipantFilter(new Set(), undefined)).toBe(true)
  })
})
