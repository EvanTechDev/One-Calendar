import { describe, it, expect } from 'vitest'
import {
  parseRequestedRetentionDays,
  parseRetentionDays,
  secretMatches,
} from '@/lib/mcp/cleanup-config'

describe('parseRetentionDays', () => {
  it('defaults to 30 when raw is null', () => {
    expect(parseRetentionDays(null)).toBe(30)
  })

  it('defaults to 30 when raw is empty', () => {
    expect(parseRetentionDays('')).toBe(30)
  })

  it('parses a valid integer', () => {
    expect(parseRetentionDays('7')).toBe(7)
  })

  it('clamps negative values to 1', () => {
    expect(parseRetentionDays('-1')).toBe(1)
  })

  it('clamps huge values to 3650', () => {
    expect(parseRetentionDays('99999')).toBe(3650)
  })

  it('falls back to default for non-numeric input', () => {
    expect(parseRetentionDays('abc')).toBe(30)
  })

  it('falls back to default for non-integer input', () => {
    expect(parseRetentionDays('7.5')).toBe(30)
  })
})

describe('parseRequestedRetentionDays', () => {
  it('reports absent as undefined, not as a default', () => {
    // Three states, not two: absent means "let the environment decide", which
    // is a different instruction from "use 30 days".
    expect(parseRequestedRetentionDays(null)).toBeUndefined()
  })

  it('accepts an in-range integer', () => {
    expect(parseRequestedRetentionDays('7')).toBe(7)
  })

  it('accepts both ends of the range', () => {
    expect(parseRequestedRetentionDays('1')).toBe(1)
    expect(parseRequestedRetentionDays('3650')).toBe(3650)
  })

  it.each(['', ' ', 'abc', '0', '-1', '3651', '7.5', 'NaN', 'Infinity'])(
    'reports %j as unusable rather than substituting a window',
    (value) => {
      expect(parseRequestedRetentionDays(value)).toBeNull()
    },
  )

  it('does not clamp, unlike the environment parser', () => {
    // The whole point: a typo from a human gets a 400, not a silent 1.
    expect(parseRequestedRetentionDays('0')).toBeNull()
    expect(parseRetentionDays('0')).toBe(1)
  })
})

describe('secretMatches', () => {
  it('returns true for an exact match', () => {
    expect(secretMatches('cron-secret-123', 'cron-secret-123')).toBe(true)
  })

  it('returns false when lengths differ', () => {
    expect(secretMatches('short', 'a-much-longer-secret')).toBe(false)
  })

  it('returns false for a wrong value of the same length', () => {
    expect(secretMatches('wrong-secret', 'right-secret')).toBe(false)
  })

  it('returns false when either side is null or undefined', () => {
    expect(secretMatches(null, 'secret')).toBe(false)
    expect(secretMatches(undefined, 'secret')).toBe(false)
    expect(secretMatches('secret', null)).toBe(false)
    expect(secretMatches('secret', undefined)).toBe(false)
  })
})
