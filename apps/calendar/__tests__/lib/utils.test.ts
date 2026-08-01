import { describe, it, expect } from 'vitest'
import { format, parseISO, isValid } from 'date-fns'

describe('date utilities', () => {
  it('formats date correctly', () => {
    const date = new Date(2025, 0, 15, 10, 30)
    expect(format(date, 'yyyy-MM-dd')).toBe('2025-01-15')
    expect(format(date, 'HH:mm')).toBe('10:30')
    expect(format(date, 'EEEE')).toBe('Wednesday')
  })

  it('parses ISO date strings', () => {
    const parsed = parseISO('2025-01-15T10:30:00.000Z')
    expect(parsed.getFullYear()).toBe(2025)
    expect(parsed.getMonth()).toBe(0)
    expect(parsed.getDate()).toBe(15)
  })

  it('validates dates', () => {
    expect(isValid(new Date(2025, 0, 15))).toBe(true)
    expect(isValid(new Date('invalid'))).toBe(false)
    expect(isValid(null)).toBe(false)
  })
})

describe('event utilities', () => {
  const createEvent = (overrides = {}) => ({
    id: '1',
    title: 'Test Event',
    startDate: new Date(2025, 0, 15, 10, 0),
    endDate: new Date(2025, 0, 15, 11, 0),
    isAllDay: false,
    recurrence: 'none',
    participants: [],
    notification: 0,
    color: 'bg-[#E6F6FD]',
    calendarId: 'cal-1',
    ...overrides,
  })

  it('filters events by date', () => {
    const events = [
      createEvent({ id: '1', startDate: new Date(2025, 0, 15, 10, 0) }),
      createEvent({ id: '2', startDate: new Date(2025, 0, 16, 10, 0) }),
      createEvent({ id: '3', startDate: new Date(2025, 0, 15, 14, 0) }),
    ]

    const dayEvents = events.filter((e) => {
      const start = new Date(e.startDate)
      return (
        start.getDate() === 15 &&
        start.getMonth() === 0 &&
        start.getFullYear() === 2025
      )
    })

    expect(dayEvents).toHaveLength(2)
    expect(dayEvents.map((e) => e.id)).toEqual(['1', '3'])
  })

  it('sorts events by start time', () => {
    const events = [
      createEvent({ id: '1', startDate: new Date(2025, 0, 15, 14, 0) }),
      createEvent({ id: '2', startDate: new Date(2025, 0, 15, 10, 0) }),
      createEvent({ id: '3', startDate: new Date(2025, 0, 15, 12, 0) }),
    ]

    events.sort(
      (a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    )

    expect(events.map((e) => e.id)).toEqual(['2', '3', '1'])
  })

  it('calculates event duration in minutes', () => {
    const event = createEvent({
      startDate: new Date(2025, 0, 15, 10, 0),
      endDate: new Date(2025, 0, 15, 11, 30),
    })

    const duration =
      new Date(event.endDate).getTime() - new Date(event.startDate).getTime()
    const durationMinutes = Math.round(duration / (1000 * 60))

    expect(durationMinutes).toBe(90)
  })

  it('detects all-day events', () => {
    const allDayEvent = createEvent({
      isAllDay: true,
      startDate: new Date(2025, 0, 15, 0, 0),
      endDate: new Date(2025, 0, 16, 0, 0),
    })

    const regularEvent = createEvent({
      isAllDay: false,
      startDate: new Date(2025, 0, 15, 10, 0),
      endDate: new Date(2025, 0, 15, 11, 0),
    })

    expect(allDayEvent.isAllDay).toBe(true)
    expect(regularEvent.isAllDay).toBe(false)
  })

  it('detects multi-day events', () => {
    const multiDayEvent = createEvent({
      startDate: new Date(2025, 0, 15, 10, 0),
      endDate: new Date(2025, 0, 17, 11, 0),
    })

    const singleDayEvent = createEvent({
      startDate: new Date(2025, 0, 15, 10, 0),
      endDate: new Date(2025, 0, 15, 11, 0),
    })

    const isMultiDay = (start: Date, end: Date) =>
      start.getDate() !== end.getDate() ||
      start.getMonth() !== end.getMonth() ||
      start.getFullYear() !== end.getFullYear()

    expect(isMultiDay(multiDayEvent.startDate, multiDayEvent.endDate)).toBe(
      true,
    )
    expect(isMultiDay(singleDayEvent.startDate, singleDayEvent.endDate)).toBe(
      false,
    )
  })
})

describe('color utilities', () => {
  it('maps event colors to accent colors', () => {
    const colorMap: Record<string, string> = {
      'bg-[#E6F6FD]': '#3B82F6',
      'bg-[#E7F8F2]': '#10B981',
      'bg-[#FEF5E6]': '#F59E0B',
    }

    expect(colorMap['bg-[#E6F6FD]']).toBe('#3B82F6')
    expect(colorMap['bg-[#E7F8F2]']).toBe('#10B981')
    expect(colorMap['bg-[#FEF5E6]']).toBe('#F59E0B')
    expect(colorMap['unknown']).toBeUndefined()
  })

  it('provides fallback for unknown colors', () => {
    const getAccentColor = (color?: string) => {
      const colorMap: Record<string, string> = {
        'bg-[#E6F6FD]': '#3B82F6',
      }
      return colorMap[color ?? ''] ?? '#3A3A3A'
    }

    expect(getAccentColor('bg-[#E6F6FD]')).toBe('#3B82F6')
    expect(getAccentColor('unknown')).toBe('#3A3A3A')
    expect(getAccentColor(undefined)).toBe('#3A3A3A')
    expect(getAccentColor('')).toBe('#3A3A3A')
  })
})
