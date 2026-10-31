await import('./../../support/dom')
import { describe, expect, it } from 'bun:test'
const { CALENDAR_COLOR_OPTIONS, applyCalendarColor, normalizeCalendarColor } =
  await import('@zntr/calendar/lib/calendar-colors')

describe('calendar colors', () => {
  it('offers the default and requested color choices', () => {
    expect(CALENDAR_COLOR_OPTIONS.map(({ value }) => value)).toEqual([
      'black-white',
      'orange',
      'yellow',
      'blue',
      'green',
      'pink',
      'purple',
    ])
  })

  it('falls back to the existing black and white palette', () => {
    expect(normalizeCalendarColor(undefined)).toBe('black-white')
    expect(normalizeCalendarColor('unexpected')).toBe('black-white')
  })

  it('applies a selected color to the document and restores the default', () => {
    const root = document.documentElement
    root.removeAttribute('data-calendar-color')

    applyCalendarColor('purple')
    expect(root.dataset.calendarColor).toBe('purple')

    applyCalendarColor(undefined)
    expect(root.hasAttribute('data-calendar-color')).toBe(false)
  })
})
