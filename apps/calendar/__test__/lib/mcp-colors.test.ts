import { describe, it, expect } from 'vitest'
import { COLOR_NAMES, COLOR_HEX_VALUES, normalizeColor } from '@/lib/mcp/colors'

describe('mcp colors', () => {
  it('defines 9 color names and hex values', () => {
    expect(COLOR_NAMES).toHaveLength(9)
    expect(COLOR_HEX_VALUES).toHaveLength(9)
  })

  it('normalizes color names to app color values', () => {
    expect(normalizeColor('blue')).toBe('bg-[#E6F6FD]')
    expect(normalizeColor('teal')).toBe('bg-[#E6FAF7]')
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
