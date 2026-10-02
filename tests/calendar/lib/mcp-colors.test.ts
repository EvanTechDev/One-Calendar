import { describe, it, expect } from 'vitest'
import {
  COLOR_OPTIONS,
  COLOR_NAMES,
  COLOR_HEX_VALUES,
  normalizeColor,
  normalizeCountdownColor,
  COUNTDOWN_COLOR_NAMES,
} from '@/lib/mcp/colors'
import { EVENT_COLORS } from '@/lib/event-colors'

describe('mcp colors', () => {
  it('offers a colour for every event colour the table defines', () => {
    // Indigo and orange were missing here even though POST /api/events accepted
    // both, so an MCP client could create an event it could not name back.
    expect(COLOR_OPTIONS).toHaveLength(EVENT_COLORS.length)
    expect(COLOR_NAMES).toHaveLength(EVENT_COLORS.length)
    expect(COLOR_HEX_VALUES).toHaveLength(EVENT_COLORS.length)
  })

  it('names every colour in the table', () => {
    expect(new Set(COLOR_NAMES)).toEqual(
      new Set(EVENT_COLORS.map((c) => c.mcpName)),
    )
  })

  it('normalizes color names to app color values', () => {
    expect(normalizeColor('blue')).toBe('bg-[#E6F6FD]')
    expect(normalizeColor('teal')).toBe('bg-[#E6FAF7]')
    expect(normalizeColor('indigo')).toBe('bg-[#EEF2FF]')
    expect(normalizeColor('orange')).toBe('bg-[#FFF0E5]')
  })

  it('normalizes hex codes to app color values', () => {
    expect(normalizeColor('#3B82F6')).toBe('bg-[#E6F6FD]')
    expect(normalizeColor('#14B8A6')).toBe('bg-[#E6FAF7]')
  })

  it('normalizes hex codes case-insensitively', () => {
    expect(normalizeColor('#3b82f6')).toBe('bg-[#E6F6FD]')
  })

  it('keeps already-normalized values unchanged', () => {
    expect(normalizeColor('bg-[#E6F6FD]')).toBe('bg-[#E6F6FD]')
  })

  it('keeps unknown values unchanged', () => {
    expect(normalizeColor('rainbow')).toBe('rainbow')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeColor(' blue ')).toBe('bg-[#E6F6FD]')
  })
})

describe('normalizeCountdownColor', () => {
  it('defines the countdown palette names', () => {
    expect(COUNTDOWN_COLOR_NAMES).toContain('blue')
    expect(COUNTDOWN_COLOR_NAMES).toContain('indigo')
    expect(COUNTDOWN_COLOR_NAMES).toContain('orange')
  })

  it('maps color names to tailwind palette classes', () => {
    expect(normalizeCountdownColor('blue')).toBe('bg-blue-500')
    expect(normalizeCountdownColor('green')).toBe('bg-green-500')
    expect(normalizeCountdownColor('red')).toBe('bg-red-500')
    expect(normalizeCountdownColor('purple')).toBe('bg-purple-500')
  })

  it('maps hex codes to palette classes', () => {
    expect(normalizeCountdownColor('#3B82F6')).toBe('bg-blue-500')
    expect(normalizeCountdownColor('#3b82f6')).toBe('bg-blue-500')
    expect(normalizeCountdownColor('#EF4444')).toBe('bg-red-500')
  })

  it('keeps already-palette values unchanged', () => {
    expect(normalizeCountdownColor('bg-blue-500')).toBe('bg-blue-500')
  })

  it('maps event-style values to the matching palette class', () => {
    expect(normalizeCountdownColor('bg-[#E6F6FD]')).toBe('bg-blue-500')
    expect(normalizeCountdownColor('bg-[#FFE4E6]')).toBe('bg-red-500')
    expect(normalizeCountdownColor('bg-[#E6FAF7]')).toBe('bg-teal-500')
  })

  it('keeps unknown values unchanged', () => {
    expect(normalizeCountdownColor('rainbow')).toBe('rainbow')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeCountdownColor(' blue ')).toBe('bg-blue-500')
  })
})
