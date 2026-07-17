import { describe, it, expect } from 'vitest'
import {
  getEventAccentColor,
  getEventBackgroundColor,
  CHART_COLOR_ORDER,
} from '../event-colors'

describe('getEventAccentColor', () => {
  it('returns mapped hex for known bg class', () => {
    expect(getEventAccentColor('bg-[#E6F6FD]')).toBe('#3B82F6')
  })

  it('returns default for unknown color', () => {
    expect(getEventAccentColor('bg-red-999')).toBe('#3A3A3A')
  })

  it('returns default for undefined', () => {
    expect(getEventAccentColor()).toBe('#3A3A3A')
  })
})

describe('getEventBackgroundColor', () => {
  it('returns dark variant when isDark is true', () => {
    expect(getEventBackgroundColor('bg-[#E6F6FD]', true)).toBe('#2F4655')
  })

  it('returns undefined when isDark is false', () => {
    expect(getEventBackgroundColor('bg-[#E6F6FD]', false)).toBeUndefined()
  })

  it('returns undefined for undefined color', () => {
    expect(getEventBackgroundColor(undefined, true)).toBeUndefined()
  })
})

describe('CHART_COLOR_ORDER', () => {
  it('has 7 colors', () => {
    expect(CHART_COLOR_ORDER).toHaveLength(7)
  })

  it('contains only valid hex colors', () => {
    CHART_COLOR_ORDER.forEach((color) => {
      expect(color).toMatch(/^#[0-9a-f]{6}$/)
    })
  })
})
