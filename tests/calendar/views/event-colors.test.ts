import { describe, it, expect } from 'vitest'
import {
  EVENT_COLORS,
  EVENT_BG_TO_ACCENT,
  EVENT_BG_TO_DARK,
  DEFAULT_ACCENT,
  TAILWIND_BG_TO_HEX,
  CHART_COLOR_ORDER,
  EVENT_COLOR_OPTIONS,
  PALETTE_COLOR_OPTIONS,
  EVENT_COLOR_VALUES,
  CALENDAR_COLOR_TO_EVENT_COLOR,
  PALETTE_TO_EVENT_COLOR,
  paletteColorName,
  getEventAccentColor,
  getEventBackgroundColor,
  type ColorOption,
} from '@zntr/ui/calendar/lib/event-colors'

const HEX = /^#[0-9A-F]{6}$/

describe('event-colors', () => {
  // These are the tests that would have caught the drift this file now guards.
  // The table used to be four hand-copied maps that disagreed with each other,
  // and a suite that re-typed every hex passed happily while indigo and orange
  // had no dark-mode background at all. So the invariants are derived from
  // EVENT_COLORS rather than restated.
  describe('EVENT_COLORS invariants', () => {
    it('gives every colour a distinct event background', () => {
      const values = EVENT_COLORS.map((c) => c.value)
      expect(new Set(values).size).toBe(values.length)
    })

    it('uses an arbitrary hex class for every event background', () => {
      for (const color of EVENT_COLORS) {
        expect(color.value).toMatch(/^bg-\[#[0-9A-F]{6}\]$/)
      }
    })

    it('gives every colour a distinct calendar swatch', () => {
      const swatches = EVENT_COLORS.map((c) => c.calendarColor)
      expect(new Set(swatches).size).toBe(swatches.length)
    })

    it('gives every colour an accent, a dark background and a calendar hex', () => {
      for (const color of EVENT_COLORS) {
        expect(color.accent, `${color.value} accent`).toMatch(HEX)
        expect(color.dark, `${color.value} dark`).toMatch(HEX)
        expect(color.calendarHex, `${color.value} calendarHex`).toMatch(HEX)
      }
    })

    it('gives every colour a distinct mcp name', () => {
      const names = EVENT_COLORS.map((c) => c.mcpName)
      expect(new Set(names).size).toBe(names.length)
    })

    it('derives every calendar swatch name from bg-<name>-500', () => {
      for (const color of EVENT_COLORS) {
        expect(paletteColorName(color.calendarColor)).toBe(
          color.calendarColor.slice(3, -4),
        )
      }
    })
  })

  describe('EVENT_BG_TO_ACCENT', () => {
    it('covers every colour in the table', () => {
      for (const color of EVENT_COLORS) {
        expect(EVENT_BG_TO_ACCENT[color.value], color.value).toBe(color.accent)
      }
      expect(Object.keys(EVENT_BG_TO_ACCENT)).toHaveLength(EVENT_COLORS.length)
    })
  })

  describe('EVENT_BG_TO_DARK', () => {
    // This one used to be short by exactly the two colours the MCP path could
    // already create, so those events rendered with no dark-mode background.
    it('covers every colour in the table', () => {
      for (const color of EVENT_COLORS) {
        expect(EVENT_BG_TO_DARK[color.value], color.value).toBe(color.dark)
      }
      expect(Object.keys(EVENT_BG_TO_DARK)).toHaveLength(EVENT_COLORS.length)
    })

    it('has a dark background for the colours the API accepts but the old table omitted', () => {
      expect(EVENT_BG_TO_DARK['bg-[#EEF2FF]']).toMatch(HEX)
      expect(EVENT_BG_TO_DARK['bg-[#FFF0E5]']).toMatch(HEX)
    })
  })

  describe('TAILWIND_BG_TO_HEX', () => {
    it('resolves every calendar swatch to its hex', () => {
      for (const color of EVENT_COLORS) {
        expect(
          TAILWIND_BG_TO_HEX[color.calendarColor],
          color.calendarColor,
        ).toBe(color.calendarHex)
      }
    })

    it('resolves the amber alias to the accent of the colour it aliases', () => {
      expect(TAILWIND_BG_TO_HEX['bg-amber-500']).toBe('#F59E0B')
      expect(CALENDAR_COLOR_TO_EVENT_COLOR['bg-amber-500']).toBe('bg-[#FEF5E6]')
    })

    it('resolves every key it advertises to a hex', () => {
      for (const [key, hex] of Object.entries(TAILWIND_BG_TO_HEX)) {
        expect(hex, key).toMatch(HEX)
      }
    })
  })

  describe('CHART_COLOR_ORDER', () => {
    it('lists every colour, so none falls through to the catch-all', () => {
      // Indigo and orange used to be absent, so a category in either hue
      // charted as teal. Teal is last because it is what anything still
      // unmatched resolves to; the rest keep the order charts have used.
      expect(CHART_COLOR_ORDER).toEqual([
        '#3b82f6',
        '#10b981',
        '#f59e0b',
        '#ef4444',
        '#8b5cf6',
        '#ec4899',
        '#6366f1',
        '#fb923c',
        '#14b8a6',
      ])
    })

    it('is exactly the table accents, lowercased', () => {
      expect(CHART_COLOR_ORDER).toEqual(
        EVENT_COLORS.map((c) => c.accent.toLowerCase()),
      )
    })

    it('contains no duplicates', () => {
      expect(new Set(CHART_COLOR_ORDER).size).toBe(CHART_COLOR_ORDER.length)
    })
  })

  describe('EVENT_COLOR_OPTIONS', () => {
    it('offers exactly the seven selectable swatches', () => {
      // The event palette is seven and has always been seven — countdown,
      // category, event and MCP all agree on that. Indigo and orange live in
      // EVENT_COLORS so an event arriving wearing one still renders, but they
      // are not offered for choosing.
      expect(EVENT_COLOR_OPTIONS).toHaveLength(7)
      expect(
        EVENT_COLOR_OPTIONS.map((o) => o.value).filter((v) =>
          /EEF2FF|FFF0E5/.test(v),
        ),
      ).toEqual([])
    })

    it('offers one swatch per selectable colour in the table', () => {
      const selectable = EVENT_COLORS.filter((c) => c.selectable !== false)
      expect(EVENT_COLOR_OPTIONS).toHaveLength(selectable.length)
    })

    it('each option has required properties', () => {
      EVENT_COLOR_OPTIONS.forEach((option: ColorOption) => {
        expect(option).toHaveProperty('value')
        expect(option).toHaveProperty('labelKey')
        expect(option).toHaveProperty('calendarColor')
      })
    })

    it('is the selectable subset of the table, in order', () => {
      expect(EVENT_COLOR_OPTIONS.map((o) => o.value)).toEqual(
        EVENT_COLORS.filter((c) => c.selectable !== false).map((c) => c.value),
      )
    })
  })

  describe('PALETTE_COLOR_OPTIONS', () => {
    it('is the seven the product has always offered', () => {
      // Category/countdown palette. Not derived from EVENT_COLORS: it is a
      // different list of different things (Tailwind classes, not event
      // backgrounds) and it is seven. Deriving it once turned this into ten.
      expect(PALETTE_COLOR_OPTIONS).toHaveLength(7)
    })

    it('keeps the order the colour menu has always rendered', () => {
      expect(PALETTE_COLOR_OPTIONS.map((o) => o.value)).toEqual([
        'bg-blue-500',
        'bg-green-500',
        'bg-yellow-500',
        'bg-red-500',
        'bg-purple-500',
        'bg-pink-500',
        'bg-teal-500',
      ])
    })

    it('offers no amber alias, indigo or orange', () => {
      // All three arrived with the nine-colour experiment. None of them was in
      // this menu before it, and `bg-amber-500` in particular duplicated
      // `bg-yellow-500`.
      const values = PALETTE_COLOR_OPTIONS.map((o) => o.value)
      expect(values).not.toContain('bg-amber-500')
      expect(values).not.toContain('bg-indigo-500')
      expect(values).not.toContain('bg-orange-500')
    })

    it('labels the yellow entry "Yellow", as this menu always has', () => {
      expect(
        PALETTE_COLOR_OPTIONS.find((o) => o.value === 'bg-yellow-500')
          ?.labelKey,
      ).toBe('colorYellow')
    })
  })

  describe('EVENT_COLOR_VALUES', () => {
    it('is the set of every event background the API accepts', () => {
      expect([...EVENT_COLOR_VALUES].sort()).toEqual(
        EVENT_COLORS.map((c) => c.value).sort(),
      )
    })
  })

  describe('CALENDAR_COLOR_TO_EVENT_COLOR', () => {
    it('maps every calendar swatch to its event background', () => {
      for (const color of EVENT_COLORS) {
        expect(
          CALENDAR_COLOR_TO_EVENT_COLOR[color.calendarColor],
          color.calendarColor,
        ).toBe(color.value)
      }
    })

    it('is the same map the MCP tools validate against', () => {
      expect(PALETTE_TO_EVENT_COLOR).toBe(CALENDAR_COLOR_TO_EVENT_COLOR)
    })
  })

  describe('getEventAccentColor', () => {
    it('returns the accent for every colour in the table', () => {
      for (const color of EVENT_COLORS) {
        expect(getEventAccentColor(color.value)).toBe(color.accent)
      }
    })

    it('returns DEFAULT_ACCENT for unknown colors', () => {
      expect(getEventAccentColor('bg-unknown')).toBe(DEFAULT_ACCENT)
      expect(getEventAccentColor('')).toBe(DEFAULT_ACCENT)
      expect(getEventAccentColor(undefined)).toBe(DEFAULT_ACCENT)
    })
  })

  describe('getEventBackgroundColor', () => {
    it('returns a dark background for every colour in the table', () => {
      for (const color of EVENT_COLORS) {
        expect(getEventBackgroundColor(color.value, true), color.value).toBe(
          color.dark,
        )
      }
    })

    it('returns undefined for light mode', () => {
      expect(getEventBackgroundColor('bg-[#E6F6FD]', false)).toBeUndefined()
    })

    it('returns undefined for undefined color', () => {
      expect(getEventBackgroundColor(undefined, true)).toBeUndefined()
    })

    it('returns undefined for unknown colors in dark mode', () => {
      expect(getEventBackgroundColor('bg-unknown', true)).toBeUndefined()
    })
  })

  describe('DEFAULT_ACCENT', () => {
    it('has default fallback color', () => {
      expect(DEFAULT_ACCENT).toBe('#3A3A3A')
    })
  })
})
