import { describe, it, expect } from 'vitest'
import {
  COLOR_OPTIONS,
  COLOR_NAMES,
  COLOR_HEX_VALUES,
  normalizeColor,
  normalizeCountdownColor,
  COUNTDOWN_COLOR_NAMES,
} from '@/lib/mcp/colors'
import { EVENT_COLORS } from '@zntr/ui/calendar/lib/event-colors'

describe('mcp colors', () => {
  it('offers a colour for every selectable event colour', () => {
    // Seven, matching the event colour menu. Indigo and orange are accepted as
    // input — POST /api/events still takes them, and an existing event can wear
    // one — but they are not offered, so they are not in the tool's colour list.
    const selectable = EVENT_COLORS.filter((c) => c.selectable !== false)
    expect(COLOR_OPTIONS).toHaveLength(selectable.length)
    expect(COLOR_NAMES).toHaveLength(selectable.length)
    expect(COLOR_HEX_VALUES).toHaveLength(selectable.length)
    expect(COLOR_OPTIONS.map((c) => c.name)).not.toContain('indigo')
    expect(COLOR_OPTIONS.map((c) => c.name)).not.toContain('orange')
  })

  it('names every selectable colour in the table', () => {
    expect(new Set(COLOR_NAMES)).toEqual(
      new Set(
        EVENT_COLORS.filter((c) => c.selectable !== false).map(
          (c) => c.mcpName,
        ),
      ),
    )
  })

  it('normalizes color names to app color values', () => {
    expect(normalizeColor('blue')).toBe('bg-[#E6F6FD]')
    expect(normalizeColor('teal')).toBe('bg-[#E6FAF7]')
    // The seven names, and only those seven. `indigo` and `orange` are not
    // names a client can ask for; an event wearing one carries its raw
    // `bg-[#EEF2FF]` value, which passes through untouched and is still a
    // valid colour everywhere else.
    expect(normalizeColor('indigo')).toBe('indigo')
    expect(normalizeColor('bg-[#EEF2FF]')).toBe('bg-[#EEF2FF]')
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
  it('defines the countdown palette names, all seven', () => {
    // Same seven as the category menu. Indigo, orange and the amber alias are
    // not offered.
    expect(COUNTDOWN_COLOR_NAMES).toEqual([
      'blue',
      'green',
      'yellow',
      'red',
      'purple',
      'pink',
      'teal',
    ])
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
