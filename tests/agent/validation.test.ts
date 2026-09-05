import { describe, expect, it } from 'vitest'
import {
  EVENT_COLOR_OPTIONS,
  colorNameToHex,
  isKnownColor,
  parseInstantRange,
  parseIsoInstant,
  validateRrule,
} from '@zntr/agent/validation'

describe('color palette', () => {
  it('mirrors the app palette (lib/mcp/colors.ts COLOR_OPTIONS)', () => {
    // If this fails, the app palette changed — update validation.ts to
    // match, in lockstep. See the comment there.
    expect(EVENT_COLOR_OPTIONS).toEqual([
      { name: 'blue', hex: '#3B82F6' },
      { name: 'green', hex: '#10B981' },
      { name: 'amber', hex: '#F59E0B' },
      { name: 'red', hex: '#EF4444' },
      { name: 'purple', hex: '#8B5CF6' },
      { name: 'pink', hex: '#EC4899' },
      { name: 'teal', hex: '#14B8A6' },
    ])
  })

  it('maps names to hex, case-insensitively', () => {
    expect(colorNameToHex('blue')).toBe('#3B82F6')
    expect(colorNameToHex('Teal')).toBe('#14B8A6')
    expect(colorNameToHex(' red ')).toBe('#EF4444')
  })

  it('passes known hexes through and rejects unknown values', () => {
    expect(colorNameToHex('#10b981')).toBe('#10B981')
    expect(colorNameToHex('#123456')).toBeNull()
    expect(colorNameToHex('magenta')).toBeNull()
    expect(isKnownColor('pink')).toBe(true)
    expect(isKnownColor('#EC4899')).toBe(true)
    expect(isKnownColor('salmon')).toBe(false)
  })
})

describe('parseIsoInstant', () => {
  it('accepts full ISO with offset and normalizes to UTC', () => {
    const parsed = parseIsoInstant('2026-09-08T15:00:00+08:00', 'start')
    expect(parsed).not.toHaveProperty('error')
    if (!('error' in parsed)) {
      expect(parsed.iso).toBe('2026-09-08T07:00:00.000Z')
    }
  })

  it('accepts Z and second-less times', () => {
    expect(parseIsoInstant('2026-09-08T15:00Z', 'start')).not.toHaveProperty(
      'error',
    )
    expect(
      parseIsoInstant('2026-09-08T15:00:00.500Z', 'start'),
    ).not.toHaveProperty('error')
  })

  it('rejects prose, bare dates and offset-less times', () => {
    for (const bad of [
      'tomorrow 3pm',
      '2026-09-08',
      '2026-09-08T15:00:00',
      '2026-9-8T15:00:00Z',
      '',
    ]) {
      const parsed = parseIsoInstant(bad, 'start')
      expect(parsed).toHaveProperty('error')
      if ('error' in parsed) {
        expect(parsed.error).toContain('ISO 8601')
      }
    }
  })

  it('rejects a well-formed but impossible date', () => {
    const parsed = parseIsoInstant('2026-13-45T15:00:00Z', 'start')
    expect(parsed).toHaveProperty('error')
  })
})

describe('parseInstantRange', () => {
  it('requires end after start', () => {
    const range = parseInstantRange(
      '2026-09-08T16:00:00Z',
      '2026-09-08T15:00:00Z',
    )
    expect(range).toHaveProperty('error')
    if ('error' in range) {
      expect(range.error).toContain('must be after')
    }
  })

  it('rejects equal instants', () => {
    expect(
      parseInstantRange('2026-09-08T15:00:00Z', '2026-09-08T15:00:00Z'),
    ).toHaveProperty('error')
  })
})

describe('validateRrule', () => {
  it('accepts real rules, with or without the RRULE: prefix', () => {
    expect(validateRrule('FREQ=WEEKLY;BYDAY=MO,WE')).toBeNull()
    expect(validateRrule('RRULE:FREQ=DAILY;COUNT=5')).toBeNull()
    expect(validateRrule('INTERVAL=2;FREQ=MONTHLY')).toBeNull()
  })

  it('rejects prose and FREQ-less strings', () => {
    expect(validateRrule('every monday')).toContain('FREQ=')
    expect(validateRrule('BYDAY=MO')).toContain('FREQ=')
    expect(validateRrule('FREQ=FORTNIGHTLY')).toContain('FREQ=')
  })
})
