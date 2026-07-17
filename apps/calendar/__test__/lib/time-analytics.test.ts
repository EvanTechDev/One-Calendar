import { describe, it, expect } from 'vitest'
import {
  analyzeTimeUsage,
  type TimeCategory,
} from '@/lib/time-analytics'
import type { CalendarEvent } from '@/components/app/calendar'

describe('analyzeTimeUsage', () => {
  const baseEvent: CalendarEvent = {
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
  }

  const createEvent = (
    overrides: Partial<CalendarEvent> = {},
  ): CalendarEvent => ({
    ...baseEvent,
    ...overrides,
  })

  const categories: TimeCategory[] = [
    {
      id: 'work',
      name: 'Work',
      color: '#0066FF',
      keywords: ['meeting', 'work'],
    },
    {
      id: 'personal',
      name: 'Personal',
      color: '#FF6600',
      keywords: ['gym', 'personal'],
    },
  ]

  it('returns zeroed analytics for empty events', () => {
    const result = analyzeTimeUsage([], categories)

    expect(result.totalEvents).toBe(0)
    expect(result.totalHours).toBe(0)
    expect(result.categorizedHours.work).toBe(0)
    expect(result.categorizedHours.personal).toBe(0)
    expect(result.categorizedHours.uncategorized).toBe(0)
    expect(result.activeDays).toBe(0)
    expect(result.averageEventDuration).toBe(0)
  })

  it('calculates total events correctly', () => {
    const events = [
      createEvent({ id: '1', title: 'Event 1' }),
      createEvent({ id: '2', title: 'Event 2' }),
    ]
    const result = analyzeTimeUsage(events, categories)

    expect(result.totalEvents).toBe(2)
  })

  it('calculates total hours correctly', () => {
    const events = [
      createEvent({
        id: '1',
        startDate: new Date(2025, 0, 15, 10, 0),
        endDate: new Date(2025, 0, 15, 12, 0),
      }),
      createEvent({
        id: '2',
        startDate: new Date(2025, 0, 15, 14, 0),
        endDate: new Date(2025, 0, 15, 15, 30),
      }),
    ]
    const result = analyzeTimeUsage(events, categories)

    expect(result.totalHours).toBe(3.5)
  })

  it('categorizes events by calendarId', () => {
    const events = [
      createEvent({
        id: '1',
        calendarId: 'work',
        startDate: new Date(2025, 0, 15, 10, 0),
        endDate: new Date(2025, 0, 15, 11, 0),
      }),
      createEvent({
        id: '2',
        calendarId: 'personal',
        startDate: new Date(2025, 0, 15, 14, 0),
        endDate: new Date(2025, 0, 15, 15, 0),
      }),
    ]
    const result = analyzeTimeUsage(events, categories)

    expect(result.categorizedHours.work).toBe(1)
    expect(result.categorizedHours.personal).toBe(1)
    expect(result.categorizedHours.uncategorized).toBe(0)
  })

  it('categorizes events by keywords', () => {
    const events = [
      createEvent({
        id: '1',
        title: 'Team Meeting',
        calendarId: 'other',
        startDate: new Date(2025, 0, 15, 10, 0),
        endDate: new Date(2025, 0, 15, 11, 0),
      }),
      createEvent({
        id: '2',
        title: 'Gym Session',
        calendarId: 'other',
        startDate: new Date(2025, 0, 15, 14, 0),
        endDate: new Date(2025, 0, 15, 15, 0),
      }),
    ]
    const result = analyzeTimeUsage(events, categories)

    expect(result.categorizedHours.work).toBe(1)
    expect(result.categorizedHours.personal).toBe(1)
    expect(result.categorizedHours.uncategorized).toBe(0)
  })

  it('handles all-day events correctly', () => {
    const events = [
      createEvent({
        id: '1',
        isAllDay: true,
        startDate: new Date(2025, 0, 15, 0, 0),
        endDate: new Date(2025, 0, 16, 0, 0),
      }),
    ]
    const result = analyzeTimeUsage(events, categories)

    expect(result.totalHours).toBe(24)
  })

  it('calculates most productive day', () => {
    const events = [
      createEvent({
        id: '1',
        startDate: new Date(2025, 0, 15, 10, 0),
        endDate: new Date(2025, 0, 15, 12, 0),
      }),
      createEvent({
        id: '2',
        startDate: new Date(2025, 0, 15, 14, 0),
        endDate: new Date(2025, 0, 15, 16, 0),
      }),
      createEvent({
        id: '3',
        startDate: new Date(2025, 0, 16, 10, 0),
        endDate: new Date(2025, 0, 16, 11, 0),
      }),
    ]
    const result = analyzeTimeUsage(events, categories)

    expect(result.mostProductiveDay).toBe('2025-01-15')
  })

  it('calculates most productive hour', () => {
    const events = [
      createEvent({
        id: '1',
        startDate: new Date(2025, 0, 15, 10, 0),
        endDate: new Date(2025, 0, 15, 11, 0),
      }),
      createEvent({
        id: '2',
        startDate: new Date(2025, 0, 15, 10, 0),
        endDate: new Date(2025, 0, 15, 11, 0),
      }),
      createEvent({
        id: '3',
        startDate: new Date(2025, 0, 15, 14, 0),
        endDate: new Date(2025, 0, 15, 15, 0),
      }),
    ]
    const result = analyzeTimeUsage(events, categories)

    expect(result.mostProductiveHour).toBe(10)
  })

  it('calculates average event duration', () => {
    const events = [
      createEvent({
        id: '1',
        startDate: new Date(2025, 0, 15, 10, 0),
        endDate: new Date(2025, 0, 15, 11, 0),
      }),
      createEvent({
        id: '2',
        startDate: new Date(2025, 0, 15, 14, 0),
        endDate: new Date(2025, 0, 15, 16, 0),
      }),
    ]
    const result = analyzeTimeUsage(events, categories)

    expect(result.averageEventDuration).toBe(1.5)
  })

  it('calculates active days', () => {
    const events = [
      createEvent({
        id: '1',
        startDate: new Date(2025, 0, 15, 10, 0),
        endDate: new Date(2025, 0, 15, 11, 0),
      }),
      createEvent({
        id: '2',
        startDate: new Date(2025, 0, 16, 10, 0),
        endDate: new Date(2025, 0, 16, 11, 0),
      }),
    ]
    const result = analyzeTimeUsage(events, categories)

    expect(result.activeDays).toBe(2)
  })

  it('identifies busiest category', () => {
    const events = [
      createEvent({
        id: '1',
        calendarId: 'work',
        startDate: new Date(2025, 0, 15, 10, 0),
        endDate: new Date(2025, 0, 15, 12, 0),
      }),
      createEvent({
        id: '2',
        calendarId: 'work',
        startDate: new Date(2025, 0, 15, 14, 0),
        endDate: new Date(2025, 0, 15, 15, 0),
      }),
      createEvent({
        id: '3',
        calendarId: 'personal',
        startDate: new Date(2025, 0, 15, 16, 0),
        endDate: new Date(2025, 0, 15, 17, 0),
      }),
    ]
    const result = analyzeTimeUsage(events, categories)

    expect(result.busiestCategoryId).toBe('work')
  })

  it('identifies longest event', () => {
    const events = [
      createEvent({
        id: '1',
        title: 'Short Meeting',
        startDate: new Date(2025, 0, 15, 10, 0),
        endDate: new Date(2025, 0, 15, 10, 30),
      }),
      createEvent({
        id: '2',
        title: 'Long Workshop',
        startDate: new Date(2025, 0, 15, 14, 0),
        endDate: new Date(2025, 0, 15, 17, 0),
      }),
    ]
    const result = analyzeTimeUsage(events, categories)

    expect(result.longestEvent.title).toBe('Long Workshop')
    expect(result.longestEvent.duration).toBe(3)
  })

  it('handles events without matching category as uncategorized', () => {
    const events = [
      createEvent({
        id: '1',
        title: 'Random Event',
        calendarId: 'unknown',
        startDate: new Date(2025, 0, 15, 10, 0),
        endDate: new Date(2025, 0, 15, 11, 0),
      }),
    ]
    const result = analyzeTimeUsage(events, categories)

    expect(result.categorizedHours.uncategorized).toBe(1)
  })

  it('handles case-insensitive keyword matching', () => {
    const events = [
      createEvent({
        id: '1',
        title: 'TEAM MEETING',
        calendarId: 'other',
        startDate: new Date(2025, 0, 15, 10, 0),
        endDate: new Date(2025, 0, 15, 11, 0),
      }),
    ]
    const result = analyzeTimeUsage(events, categories)

    expect(result.categorizedHours.work).toBe(1)
  })

  it('matches keywords in description', () => {
    const events = [
      createEvent({
        id: '1',
        title: 'Session',
        description: 'Work meeting with team',
        calendarId: 'other',
        startDate: new Date(2025, 0, 15, 10, 0),
        endDate: new Date(2025, 0, 15, 11, 0),
      }),
    ]
    const result = analyzeTimeUsage(events, categories)

    expect(result.categorizedHours.work).toBe(1)
  })
})
