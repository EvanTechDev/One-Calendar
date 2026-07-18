'use client'

import { addDays, addWeeks, addMonths, addYears } from 'date-fns'
import type { CalendarEvent } from '@/components/app/calendar'

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval?: number
  until?: Date
  count?: number
  byMonthDay?: number[]
  byDay?: string[]
  byMonth?: number[]
}

export interface ExpandedEvent extends CalendarEvent {
  isRecurrence: boolean
  originalEventId: string
  recurrenceIndex: number
}

function parseRecurrence(event: {
  recurrence?: string
}): { frequency: string; interval: number } | null {
  if (!event.recurrence || event.recurrence === 'none') return null
  const frequency = event.recurrence as
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
  return { frequency, interval: 1 }
}

function getNthOccurrence(
  startDate: Date,
  rule: { frequency: string; interval: number },
  n: number,
): Date {
  const next = new Date(startDate)
  switch (rule.frequency) {
    case 'daily':
      return addDays(next, (rule.interval || 1) * n)
    case 'weekly':
      return addWeeks(next, (rule.interval || 1) * n)
    case 'monthly':
      return addMonths(next, (rule.interval || 1) * n)
    case 'yearly':
      return addYears(next, (rule.interval || 1) * n)
    default:
      return addDays(next, n)
  }
}

function isWithinRange(
  start: Date,
  end: Date,
  rangeStart: Date,
  rangeEnd: Date,
): boolean {
  return (
    (start >= rangeStart && start <= rangeEnd) ||
    (end >= rangeStart && end <= rangeEnd) ||
    (start <= rangeStart && end >= rangeEnd)
  )
}

function isAfter(date: Date, dateToCompare: Date): boolean {
  return date.getTime() > dateToCompare.getTime()
}

export function expandRecurringEvent(
  event: CalendarEvent,
  rangeStart: Date,
  rangeEnd: Date,
  maxOccurrences = 1000,
): ExpandedEvent[] {
  const rule = parseRecurrence(event)
  if (!rule) return []

  const originalStart = new Date(event.startDate)
  const originalEnd = new Date(event.endDate)
  const duration = originalEnd.getTime() - originalStart.getTime()

  const results: ExpandedEvent[] = []

  if (isWithinRange(originalStart, originalEnd, rangeStart, rangeEnd)) {
    results.push({
      ...event,
      isRecurrence: false,
      originalEventId: event.id,
      recurrenceIndex: 0,
    })
  }

  let recurrenceIndex = 1

  while (results.length < maxOccurrences && recurrenceIndex < maxOccurrences) {
    const nextStartDate = getNthOccurrence(
      new Date(event.startDate),
      rule,
      recurrenceIndex,
    )
    const nextEndDate = new Date(nextStartDate.getTime() + duration)

    if (isAfter(nextStartDate, rangeEnd)) break

    if (isWithinRange(nextStartDate, nextEndDate, rangeStart, rangeEnd)) {
      results.push({
        ...event,
        id: `${event.id}-recur-${recurrenceIndex}`,
        startDate: nextStartDate,
        endDate: nextEndDate,
        isRecurrence: true,
        originalEventId: event.id,
        recurrenceIndex,
      })
    }

    recurrenceIndex++

    if (recurrenceIndex >= 1000) break
  }

  return results
}

export function getAllEventsInRange(
  events: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date,
): ExpandedEvent[] {
  const allEvents: Array<{
    id: string
    startDate: Date
    endDate: Date
    isRecurrence: boolean
    recurrenceIndex: number
    originalEventId: string
    [key: string]: any
  }> = []

  for (const event of events) {
    if (event.recurrence && event.recurrence !== 'none') {
      const expanded = expandRecurringEvent(event, rangeStart, rangeEnd)
      allEvents.push(...expanded)
    } else {
      const start = new Date(event.startDate)
      if (start >= rangeStart && start <= rangeEnd) {
        allEvents.push({
          ...event,
          id: event.id,
          startDate: new Date(event.startDate),
          endDate: new Date(event.endDate),
          isRecurrence: false,
          originalEventId: event.id,
          recurrenceIndex: 0,
        })
      }
    }
  }

  allEvents.sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  )
  return allEvents
}

export interface ExpandedEvent extends CalendarEvent {
  isRecurrence: boolean
  originalEventId: string
  recurrenceIndex: number
}
