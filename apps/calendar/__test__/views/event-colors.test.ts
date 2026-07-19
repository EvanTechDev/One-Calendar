import { describe, it, expect } from 'vitest'
import {
  EVENT_BG_TO_ACCENT,
  EVENT_BG_TO_DARK,
  DEFAULT_ACCENT,
  TAILWIND_BG_TO_HEX,
  CHART_COLOR_ORDER,
  EVENT_COLOR_OPTIONS,
  CALENDAR_COLOR_TO_EVENT_COLOR,
  getEventAccentColor,
  getEventBackgroundColor,
  type ColorOption,
} from '@/components/app/views/event-colors'

describe('event-colors', () => {
  describe('EVENT_BG_TO_ACCENT', () => {
    it('maps all event background colors to accent colors', () => {
      expect(EVENT_BG_TO_ACCENT['bg-[#E6F6FD]']).toBe('#3B82F6')
      expect(EVENT_BG_TO_ACCENT['bg-[#E7F8F2]']).toBe('#10B981')
      expect(EVENT_BG_TO_ACCENT['bg-[#FEF5E6]']).toBe('#F59E0B')
      expect(EVENT_BG_TO_ACCENT['bg-[#FFE4E6]']).toBe('#EF4444')
      expect(EVENT_BG_TO_ACCENT['bg-[#F3EEFE]']).toBe('#8B5CF6')
      expect(EVENT_BG_TO_ACCENT['bg-[#FCE7F3]']).toBe('#EC4899')
      expect(EVENT_BG_TO_ACCENT['bg-[#EEF2FF]']).toBe('#6366F1')
      expect(EVENT_BG_TO_ACCENT['bg-[#FFF0E5]']).toBe('#FB923C')
      expect(EVENT_BG_TO_ACCENT['bg-[#E6FAF7]']).toBe('#14B8A6')
    })

    it('has correct number of mappings', () => {
      expect(Object.keys(EVENT_BG_TO_ACCENT)).toHaveLength(9)
    })
  })

  describe('EVENT_BG_TO_DARK', () => {
    it('maps all event background colors to dark mode colors', () => {
      expect(EVENT_BG_TO_DARK['bg-[#E6F6FD]']).toBe('#2F4655')
      expect(EVENT_BG_TO_DARK['bg-[#E7F8F2]']).toBe('#2D4935')
      expect(EVENT_BG_TO_DARK['bg-[#FEF5E6]']).toBe('#4F3F1B')
      expect(EVENT_BG_TO_DARK['bg-[#FFE4E6]']).toBe('#6C2920')
      expect(EVENT_BG_TO_DARK['bg-[#F3EEFE]']).toBe('#483A63')
      expect(EVENT_BG_TO_DARK['bg-[#FCE7F3]']).toBe('#5A334A')
      expect(EVENT_BG_TO_DARK['bg-[#E6FAF7]']).toBe('#1F4A47')
    })

    it('has correct number of mappings', () => {
      expect(Object.keys(EVENT_BG_TO_DARK)).toHaveLength(7)
    })
  })

  describe('DEFAULT_ACCENT', () => {
    it('has default fallback color', () => {
      expect(DEFAULT_ACCENT).toBe('#3A3A3A')
    })
  })

  describe('TAILWIND_BG_TO_HEX', () => {
    it('maps tailwind colors to hex', () => {
      expect(TAILWIND_BG_TO_HEX['bg-blue-500']).toBe('#3b82f6')
      expect(TAILWIND_BG_TO_HEX['bg-green-500']).toBe('#10b981')
      expect(TAILWIND_BG_TO_HEX['bg-yellow-500']).toBe('#f59e0b')
      expect(TAILWIND_BG_TO_HEX['bg-red-500']).toBe('#ef4444')
      expect(TAILWIND_BG_TO_HEX['bg-purple-500']).toBe('#8b5cf6')
      expect(TAILWIND_BG_TO_HEX['bg-pink-500']).toBe('#ec4899')
      expect(TAILWIND_BG_TO_HEX['bg-teal-500']).toBe('#14b8a6')
    })

    it('also maps custom event colors', () => {
      expect(TAILWIND_BG_TO_HEX['bg-[#E6F6FD]']).toBe('#3B82F6')
      expect(TAILWIND_BG_TO_HEX['bg-[#E7F8F2]']).toBe('#10B981')
    })
  })

  describe('CHART_COLOR_ORDER', () => {
    it('has predefined chart color order', () => {
      expect(CHART_COLOR_ORDER).toEqual([
        '#3b82f6',
        '#10b981',
        '#f59e0b',
        '#ef4444',
        '#8b5cf6',
        '#ec4899',
        '#14b8a6',
      ])
    })
  })

  describe('EVENT_COLOR_OPTIONS', () => {
    it('has all color options defined', () => {
      expect(EVENT_COLOR_OPTIONS).toHaveLength(7)
    })

    it('each option has required properties', () => {
      EVENT_COLOR_OPTIONS.forEach((option: ColorOption) => {
        expect(option).toHaveProperty('value')
        expect(option).toHaveProperty('labelKey')
        expect(option).toHaveProperty('calendarColor')
      })
    })

    it('contains expected colors', () => {
      const values = EVENT_COLOR_OPTIONS.map((o) => o.value)
      expect(values).toContain('bg-[#E6F6FD]')
      expect(values).toContain('bg-[#E7F8F2]')
      expect(values).toContain('bg-[#FEF5E6]')
      expect(values).toContain('bg-[#FFE4E6]')
      expect(values).toContain('bg-[#F3EEFE]')
      expect(values).toContain('bg-[#FCE7F3]')
      expect(values).toContain('bg-[#E6FAF7]')
    })
  })

  describe('CALENDAR_COLOR_TO_EVENT_COLOR', () => {
    it('maps calendar colors to event colors', () => {
      expect(CALENDAR_COLOR_TO_EVENT_COLOR['bg-blue-500']).toBe('bg-[#E6F6FD]')
      expect(CALENDAR_COLOR_TO_EVENT_COLOR['bg-green-500']).toBe('bg-[#E7F8F2]')
      expect(CALENDAR_COLOR_TO_EVENT_COLOR['bg-yellow-500']).toBe(
        'bg-[#FEF5E6]',
      )
      expect(CALENDAR_COLOR_TO_EVENT_COLOR['bg-red-500']).toBe('bg-[#FFE4E6]')
      expect(CALENDAR_COLOR_TO_EVENT_COLOR['bg-purple-500']).toBe(
        'bg-[#F3EEFE]',
      )
      expect(CALENDAR_COLOR_TO_EVENT_COLOR['bg-pink-500']).toBe('bg-[#FCE7F3]')
      expect(CALENDAR_COLOR_TO_EVENT_COLOR['bg-teal-500']).toBe('bg-[#E6FAF7]')
    })
  })

  describe('getEventAccentColor', () => {
    it('returns accent color for known event colors', () => {
      expect(getEventAccentColor('bg-[#E6F6FD]')).toBe('#3B82F6')
      expect(getEventAccentColor('bg-[#E7F8F2]')).toBe('#10B981')
    })

    it('returns DEFAULT_ACCENT for unknown colors', () => {
      expect(getEventAccentColor('bg-unknown')).toBe(DEFAULT_ACCENT)
      expect(getEventAccentColor('')).toBe(DEFAULT_ACCENT)
      expect(getEventAccentColor(undefined)).toBe(DEFAULT_ACCENT)
    })
  })

  describe('getEventBackgroundColor', () => {
    it('returns dark background for dark mode', () => {
      expect(getEventBackgroundColor('bg-[#E6F6FD]', true)).toBe('#2F4655')
      expect(getEventBackgroundColor('bg-[#E7F8F2]', true)).toBe('#2D4935')
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
})
