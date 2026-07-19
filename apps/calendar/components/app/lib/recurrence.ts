'use client'

import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  startOfDay,
  endOfDay,
} from 'date-fns'
import type { CalendarEvent } from '@/components/app/calendar'

export type RecurrenceFrequency =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'

export interface RecurrenceRule {
  frequency: RecurrenceFrequency
  interval?: number
  until?: Date
  count?: number
  byDay?: string[]
  byMonthDay?: number[]
  byMonth?: number[]
  wkst?: string
}

export interface ExpandedEvent extends CalendarEvent {
  isRecurrence: boolean
  originalEventId: string
  recurrenceIndex: number
}

interface ParsedRule {
  frequency: RecurrenceFrequency
  interval: number
  until?: Date
  count?: number
  byDay?: number[]
  byMonthDay?: number[]
  byMonth?: number[]
  wkst?: number
}

const DAY_MAP: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
}

const _DAY_MAP_REV: Record<number, string> = {
  0: 'SU',
  1: 'MO',
  2: 'TU',
  3: 'WE',
  4: 'TH',
  5: 'FR',
  6: 'SA',
}

function parseByDay(byDay: string[]): number[] {
  return byDay.map((day) => {
    const upper = day.toUpperCase()
    if (upper.length === 2 && DAY_MAP[upper] !== undefined) {
      return DAY_MAP[upper]
    }
    if (upper.length === 3 && DAY_MAP[upper.slice(0, 2)] !== undefined) {
      return DAY_MAP[upper.slice(0, 2)]
    }
    throw new Error(`Invalid byDay value: ${day}`)
  })
}

function parseRecurrenceRule(event: CalendarEvent): ParsedRule | null {
  if (!event.recurrence || event.recurrence === 'none') return null

  try {
    const rule: RecurrenceRule = JSON.parse(event.recurrence)

    if (
      !rule.frequency ||
      !['daily', 'weekly', 'monthly', 'yearly'].includes(rule.frequency)
    ) {
      return null
    }

    return {
      frequency: rule.frequency,
      interval: Math.max(1, rule.interval || 1),
      until: rule.until ? new Date(rule.until) : undefined,
      count: rule.count ? Math.max(1, rule.count) : undefined,
      byDay: rule.byDay ? parseByDay(rule.byDay) : undefined,
      byMonthDay: rule.byMonthDay
        ? rule.byMonthDay.filter((d) => d >= -31 && d <= 31 && d !== 0)
        : undefined,
      byMonth: rule.byMonth
        ? rule.byMonth.filter((m) => m >= 1 && m <= 12)
        : undefined,
      wkst: rule.wkst ? DAY_MAP[rule.wkst.toUpperCase()] : undefined,
    }
  } catch {
    const frequency = event.recurrence as RecurrenceFrequency
    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(frequency)) {
      return null
    }
    return { frequency, interval: 1 }
  }
}

function getNextOccurrence(startDate: Date, rule: ParsedRule, n: number): Date {
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

function matchesByDay(date: Date, byDay: number[], wkst?: number): boolean {
  const dayOfWeek = date.getDay()
  const adjustedDay =
    wkst !== undefined ? (dayOfWeek - wkst + 7) % 7 : dayOfWeek
  return byDay.includes(adjustedDay)
}

function matchesByMonthDay(date: Date, byMonthDay: number[]): boolean {
  const day = date.getDate()
  const daysInMonth = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate()

  return byMonthDay.some((mday) => {
    if (mday > 0) {
      return day === mday
    }
    return day === daysInMonth + mday + 1
  })
}

function matchesByMonth(date: Date, byMonth: number[]): boolean {
  return byMonth.includes(date.getMonth() + 1)
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
  const rule = parseRecurrenceRule(event)
  if (!rule) return []

  const originalStart = new Date(event.startDate)
  const originalEnd = new Date(event.endDate)
  const duration = originalEnd.getTime() - originalStart.getTime()

  const results: ExpandedEvent[] = []

  const rangeStartDay = startOfDay(rangeStart)
  const rangeEndDay = endOfDay(rangeEnd)

  if (isWithinRange(originalStart, originalEnd, rangeStartDay, rangeEndDay)) {
    results.push({
      ...event,
      isRecurrence: false,
      originalEventId: event.id,
      recurrenceIndex: 0,
    })
  }

  let recurrenceIndex = 1

  while (results.length < maxOccurrences && recurrenceIndex < maxOccurrences) {
    const nextStartDate = getNextOccurrence(
      new Date(event.startDate),
      rule,
      recurrenceIndex,
    )
    const nextEndDate = new Date(nextStartDate.getTime() + duration)

    if (rule.until && isAfter(nextStartDate, rule.until)) break
    if (rule.count && recurrenceIndex > rule.count) break

    let shouldInclude = true

    if (rule.byDay && !matchesByDay(nextStartDate, rule.byDay, rule.wkst)) {
      shouldInclude = false
    }
    if (rule.byMonthDay && !matchesByMonthDay(nextStartDate, rule.byMonthDay)) {
      shouldInclude = false
    }
    if (rule.byMonth && !matchesByMonth(nextStartDate, rule.byMonth)) {
      shouldInclude = false
    }

    if (
      shouldInclude &&
      isWithinRange(nextStartDate, nextEndDate, rangeStartDay, rangeEndDay)
    ) {
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
): Array<
  Partial<ExpandedEvent> & {
    id: string
    startDate: Date
    endDate: Date
    isRecurrence: boolean
    recurrenceIndex: number
    originalEventId: string
    [key: string]: any
  }
> {
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

export function createRecurrenceRule(
  frequency: RecurrenceFrequency,
  options: {
    interval?: number
    until?: Date
    count?: number
    byDay?: string[]
    byMonthDay?: number[]
    byMonth?: number[]
    wkst?: string
  } = {},
): string {
  const rule: RecurrenceRule = {
    frequency,
    ...options,
  }
  return JSON.stringify(rule)
}

export function parseRecurrenceRuleString(
  ruleString: string,
): RecurrenceRule | null {
  try {
    return JSON.parse(ruleString) as RecurrenceRule
  } catch {
    return null
  }
}

export function getRecurrenceDescription(
  rule: RecurrenceRule,
  language: 'en' | 'zh' = 'en',
): string {
  const freqLabels = {
    none: language === 'zh' ? '不重复' : 'None',
    daily: language === 'zh' ? '每天' : 'Daily',
    weekly: language === 'zh' ? '每周' : 'Weekly',
    monthly: language === 'zh' ? '每月' : 'Monthly',
    yearly: language === 'zh' ? '每年' : 'Yearly',
  }

  let desc = freqLabels[rule.frequency]
  if (rule.interval && rule.interval > 1 && rule.frequency !== 'none') {
    desc =
      language === 'zh'
        ? `每 ${rule.interval} ${freqLabels[rule.frequency].slice(1)}`
        : `Every ${rule.interval} ${freqLabels[rule.frequency].toLowerCase()}s`
  }

  if (rule.byDay && rule.byDay.length > 0) {
    const dayLabels = rule.byDay.map((d) => d.toUpperCase()).join(', ')
    desc += language === 'zh' ? ` (${dayLabels})` : ` (${dayLabels})`
  }

  if (rule.until) {
    desc +=
      language === 'zh'
        ? ` 直到 ${rule.until.toLocaleDateString()}`
        : ` until ${rule.until.toLocaleDateString()}`
  }
  if (rule.count) {
    desc += language === 'zh' ? `, ${rule.count} 次` : `, ${rule.count} times`
  }

  return desc
}
