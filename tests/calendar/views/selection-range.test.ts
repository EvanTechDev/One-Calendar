import { describe, it, expect } from 'vitest'
import {
  formatSelectionRange,
  defaultCreateRange,
} from '@/components/app/views/selection-range'

describe('formatSelectionRange', () => {
  const formatHourMinute = (hour: number, minute: number) =>
    `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`

  it('formats selection range with start before end', () => {
    const result = formatSelectionRange(540, 600, formatHourMinute)
    expect(result).toBe('09:00 - 10:00')
  })

  it('normalizes when start is after end', () => {
    const result = formatSelectionRange(600, 540, formatHourMinute)
    expect(result).toBe('09:00 - 10:00')
  })

  it('handles midnight crossing', () => {
    const result = formatSelectionRange(1380, 1440, formatHourMinute)
    expect(result).toBe('23:00 - 24:00')
  })

  it('handles same start and end', () => {
    const result = formatSelectionRange(540, 540, formatHourMinute)
    expect(result).toBe('09:00 - 09:00')
  })

  it('handles 12h format function', () => {
    const format12h = (hour: number, minute: number) => {
      const period = hour >= 12 ? 'PM' : 'AM'
      const twelveHour = hour % 12 || 12
      return `${twelveHour}:${minute.toString().padStart(2, '0')} ${period}`
    }
    const result = formatSelectionRange(540, 780, format12h)
    expect(result).toBe('9:00 AM - 1:00 PM')
  })

  it('handles zero minutes', () => {
    const result = formatSelectionRange(0, 30, formatHourMinute)
    expect(result).toBe('00:00 - 00:30')
  })
})

describe('defaultCreateRange', () => {
  it('spans 30 minutes from the start', () => {
    const start = new Date('2026-08-23T10:00:00')
    const { end } = defaultCreateRange(start)
    expect(end.getTime() - start.getTime()).toBe(30 * 60000)
  })

  it('clamps to the end of the day when 30 minutes would cross midnight', () => {
    // Creating at 23:40 must not produce a range spilling into the next day:
    // the blue anchor box lives on the start day, and on the last day of the
    // visible period the spill-over day is not even rendered.
    const start = new Date('2026-08-23T23:40:00')
    const { end } = defaultCreateRange(start)
    expect(end.getDate()).toBe(23)
    expect(end.getHours()).toBe(23)
    expect(end.getMinutes()).toBe(59)
  })

  it('keeps a range ending exactly at 23:59 intact', () => {
    const start = new Date('2026-08-23T23:29:00')
    const { end } = defaultCreateRange(start)
    expect(end.getHours()).toBe(23)
    expect(end.getMinutes()).toBe(59)
  })
})
