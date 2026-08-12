import { describe, it, expect } from 'vitest'
import { formatSelectionRange } from '@/components/app/views/selection-range'

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
