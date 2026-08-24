'use client'

import { isWithinInterval, isSameDay, startOfDay, addDays } from 'date-fns'
import type { CalendarEvent } from '@/components/app/calendar'
import {
  Language,
  TimeFormat,
  ViewConfig,
  EventTimeRange,
} from '@/lib/calendar-types'

export interface LayoutEvent {
  event: CalendarEvent
  start: Date
  end: Date
  column: number
  totalColumns: number
  isMultiDay: boolean
}

/**
 * A horizontal bar for an event spanning one or more day columns inside a
 * single row of days (a month-view week row, or the week-view all-day
 * header). Events that overlap in time are stacked into `lane`s.
 */
export interface AllDaySegment {
  event: CalendarEvent
  /** Index of the first day column the bar covers (within the given row). */
  startIndex: number
  /** Number of day columns the bar covers. */
  span: number
  /** Vertical stacking lane (0 = topmost). */
  lane: number
  /** True when the event started before this row of days. */
  continuesLeft: boolean
  /** True when the event ends after this row of days. */
  continuesRight: boolean
}

export class EventLayoutEngine {
  private config: ViewConfig

  constructor(config: ViewConfig) {
    this.config = config
  }

  static create(config: ViewConfig): EventLayoutEngine {
    return new EventLayoutEngine(config)
  }

  withConfig(
    config: Partial<
      Omit<
        ViewConfig,
        'withDate' | 'withTimezone' | 'withTimeFormat' | 'equals'
      >
    >,
  ): EventLayoutEngine {
    return new EventLayoutEngine(
      ViewConfig.create({
        date: config.date ?? this.config.date,
        timezone: config.timezone ?? this.config.timezone,
        timeFormat: config.timeFormat ?? this.config.timeFormat,
        firstDayOfWeek: config.firstDayOfWeek ?? this.config.firstDayOfWeek,
        language: config.language ?? this.config.language,
        viewType: config.viewType ?? this.config.viewType,
      }),
    )
  }

  isAllDayEvent(event: CalendarEvent): boolean {
    if (event.isAllDay) return true

    const start = new Date(event.startDate)
    const end = new Date(event.endDate)

    const isFullDay =
      start.getHours() === 0 &&
      start.getMinutes() === 0 &&
      ((end.getHours() === 23 && end.getMinutes() === 59) ||
        (end.getHours() === 0 &&
          end.getMinutes() === 0 &&
          end.getDate() !== start.getDate()))

    return isFullDay
  }

  isMultiDayEvent(start: Date, end: Date): boolean {
    if (!start || !end) return false

    return (
      start.getDate() !== end.getDate() ||
      start.getMonth() !== end.getMonth() ||
      start.getFullYear() !== end.getFullYear()
    )
  }

  shouldShowEventOnDay(event: CalendarEvent, day: Date): boolean {
    return shouldShowEventOnDay(event, day)
  }

  layoutAllDaySegments(
    events: CalendarEvent[],
    rowDays: Date[],
  ): AllDaySegment[] {
    return layoutAllDaySegments(events, rowDays)
  }

  getEventTimesForDay(event: CalendarEvent, day: Date): EventTimeRange | null {
    const start = new Date(event.startDate)
    const end = new Date(event.endDate)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null

    const isMultiDay = this.isMultiDayEvent(start, end)

    let dayStart = start
    let dayEnd = end

    if (isMultiDay) {
      if (!isSameDay(start, day)) {
        dayStart = new Date(day)
        dayStart.setHours(0, 0, 0, 0)
      }

      if (!isSameDay(end, day)) {
        dayEnd = new Date(day)
        dayEnd.setHours(23, 59, 59, 999)
      }
    }

    return EventTimeRange.create({ start: dayStart, end: dayEnd, isMultiDay })
  }

  separateEvents(
    dayEvents: CalendarEvent[],
    day: Date,
  ): { allDayEvents: CalendarEvent[]; regularEvents: CalendarEvent[] } {
    return separateEvents(dayEvents, day)
  }

  layoutEventsForDay(dayEvents: CalendarEvent[], day: Date): LayoutEvent[] {
    if (!dayEvents || dayEvents.length === 0) return []

    const { regularEvents } = this.separateEvents(dayEvents, day)

    const eventsWithTimes = regularEvents
      .map((event) => {
        const times = this.getEventTimesForDay(event, day)
        if (!times) return null
        return { event, ...times }
      })
      .filter(Boolean) as Array<{
      event: CalendarEvent
      start: Date
      end: Date
      isMultiDay: boolean
    }>

    eventsWithTimes.sort((a, b) => a.start.getTime() - b.start.getTime())

    type TimePoint = { time: number; isStart: boolean; eventIndex: number }
    const timePoints: TimePoint[] = []

    eventsWithTimes.forEach((eventWithTime, index) => {
      const startTime = eventWithTime.start.getTime()
      const endTime = eventWithTime.end.getTime()

      timePoints.push({ time: startTime, isStart: true, eventIndex: index })
      timePoints.push({ time: endTime, isStart: false, eventIndex: index })
    })

    timePoints.sort((a, b) => {
      if (a.time === b.time) {
        return a.isStart ? 1 : -1
      }
      return a.time - b.time
    })

    const eventLayouts: LayoutEvent[] = []
    const activeEvents = new Set<number>()
    const eventToColumn = new Map<number, number>()

    for (let i = 0; i < timePoints.length; i++) {
      const point = timePoints[i]

      if (point.isStart) {
        activeEvents.add(point.eventIndex)

        let column = 0
        const usedColumns = new Set<number>()

        activeEvents.forEach((eventIndex) => {
          if (eventToColumn.has(eventIndex)) {
            usedColumns.add(eventToColumn.get(eventIndex)!)
          }
        })

        while (usedColumns.has(column)) {
          column++
        }

        eventToColumn.set(point.eventIndex, column)
      } else {
        activeEvents.delete(point.eventIndex)
      }

      if (
        i === timePoints.length - 1 ||
        timePoints[i + 1].time !== point.time
      ) {
        const totalColumns =
          activeEvents.size > 0
            ? Math.max(
                ...Array.from(activeEvents).map(
                  (idx) => eventToColumn.get(idx)!,
                ),
              ) + 1
            : 0

        activeEvents.forEach((eventIndex) => {
          const column = eventToColumn.get(eventIndex)!
          const { event, start, end, isMultiDay } = eventsWithTimes[eventIndex]

          const existingLayout = eventLayouts.find(
            (layout) => layout.event.id === event.id,
          )

          if (!existingLayout) {
            eventLayouts.push({
              event,
              start,
              end,
              column,
              totalColumns: Math.max(totalColumns, 1),
              isMultiDay,
            })
          }
        })
      }
    }

    return eventLayouts
  }

  snapToQuarterHour(minutes: number): number {
    const clamped = Math.min(Math.max(minutes, 0), 24 * 60)
    return Math.round(clamped / 15) * 15
  }

  formatTimeForDisplay(hour: number, minute: number): string {
    return formatTimeForDisplay(hour, minute, this.config.timeFormat)
  }

  formatHourMinute(hour: number, minute: number): string {
    return formatHourMinute(hour, minute, this.config.timeFormat)
  }

  formatDateWithTimezone(date: Date): string {
    return formatDateWithTimezone(
      date,
      this.config.language,
      this.config.timeFormat,
      this.config.timezone,
    )
  }
}

// Standalone functions for backward compatibility with tests
export function isAllDayEvent(event: CalendarEvent): boolean {
  if (event.isAllDay) return true

  const start = new Date(event.startDate)
  const end = new Date(event.endDate)

  const isFullDay =
    start.getHours() === 0 &&
    start.getMinutes() === 0 &&
    ((end.getHours() === 23 && end.getMinutes() === 59) ||
      (end.getHours() === 0 &&
        end.getMinutes() === 0 &&
        end.getDate() !== start.getDate()))

  return isFullDay
}

export function isMultiDayEvent(start: Date, end: Date): boolean {
  if (!start || !end) return false

  return (
    start.getDate() !== end.getDate() ||
    start.getMonth() !== end.getMonth() ||
    start.getFullYear() !== end.getFullYear()
  )
}

/**
 * True when the event fully covers at least one calendar day (midnight to
 * midnight). An end at 23:59 counts as reaching the next midnight.
 */
export function coversFullCalendarDay(event: CalendarEvent): boolean {
  const start = new Date(event.startDate)
  const end = new Date(event.endDate)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return false

  // First midnight at or after the start.
  const firstFullDayStart =
    start.getTime() === startOfDay(start).getTime()
      ? startOfDay(start)
      : startOfDay(addDays(start, 1))

  const effectiveEndMs =
    end.getHours() === 23 && end.getMinutes() === 59
      ? end.getTime() + 60 * 1000
      : end.getTime()

  return effectiveEndMs >= addDays(firstFullDayStart, 1).getTime()
}

/**
 * True when the event belongs in the all-day ("banner") area: explicit
 * all-day events, and multi-day timed events that fully cover at least one
 * calendar day (e.g. 1st 00:00 – 5th 16:00). Short overnight events
 * (Mon 22:00 – Tue 03:00) stay in the time grid.
 */
export function isBannerEvent(event: CalendarEvent): boolean {
  if (isAllDayEvent(event)) return true

  const start = new Date(event.startDate)
  const end = new Date(event.endDate)
  return isMultiDayEvent(start, end) && coversFullCalendarDay(event)
}

/**
 * Last calendar day an event visually occupies. An end landing exactly on
 * midnight is treated as exclusive-end (the event occupies up to the
 * previous day) — a bar for 1st 00:00 – 5th 00:00 must not cover the 5th.
 */
export function getEventLastDay(event: CalendarEvent): Date {
  const start = new Date(event.startDate)
  const end = new Date(event.endDate)

  if (
    end.getHours() === 0 &&
    end.getMinutes() === 0 &&
    !isSameDay(start, end)
  ) {
    return startOfDay(addDays(end, -1))
  }

  return startOfDay(end)
}

export function shouldShowEventOnDay(event: CalendarEvent, day: Date): boolean {
  const start = new Date(event.startDate)
  const end = new Date(event.endDate)

  if (isSameDay(start, day)) return true

  if (isMultiDayEvent(start, end)) {
    // Banner events (all-day, or timed spanning full days) occupy whole
    // calendar days; an end exactly at midnight excludes that day.
    if (isBannerEvent(event)) {
      const rangeStart = startOfDay(start)
      const rangeEnd = getEventLastDay(event)
      if (rangeEnd.getTime() < rangeStart.getTime()) return false
      return isWithinInterval(startOfDay(day), {
        start: rangeStart,
        end: rangeEnd,
      })
    }
    return isWithinInterval(day, { start, end })
  }

  return false
}

/**
 * Lays out all-day / multi-day events as horizontal bars across a row of
 * consecutive days (a month-view week row, or the week-view all-day header).
 * Longer/earlier events claim the top lanes so a spanning bar stays on a
 * single line across all its columns.
 */
export function layoutAllDaySegments(
  events: CalendarEvent[],
  rowDays: Date[],
): AllDaySegment[] {
  if (!events || events.length === 0 || rowDays.length === 0) return []

  const rowStart = startOfDay(rowDays[0])
  const rowEnd = startOfDay(rowDays[rowDays.length - 1])

  type PendingSegment = Omit<AllDaySegment, 'lane'>

  const pending: PendingSegment[] = []
  const seen = new Set<string>()

  for (const event of events) {
    if (seen.has(event.id)) continue
    seen.add(event.id)

    const eventStart = startOfDay(new Date(event.startDate))
    const eventLastDay = getEventLastDay(event)
    if (eventLastDay.getTime() < eventStart.getTime()) continue

    // Clip to this row of days
    if (
      eventLastDay.getTime() < rowStart.getTime() ||
      eventStart.getTime() > rowEnd.getTime()
    ) {
      continue
    }

    const startIndex = rowDays.findIndex(
      (day) =>
        startOfDay(day).getTime() ===
        Math.max(eventStart.getTime(), rowStart.getTime()),
    )
    let endIndex = rowDays.findIndex(
      (day) =>
        startOfDay(day).getTime() ===
        Math.min(eventLastDay.getTime(), rowEnd.getTime()),
    )
    if (startIndex === -1) continue
    if (endIndex === -1) endIndex = rowDays.length - 1

    pending.push({
      event,
      startIndex,
      span: Math.max(endIndex - startIndex + 1, 1),
      continuesLeft: eventStart.getTime() < rowStart.getTime(),
      continuesRight: eventLastDay.getTime() > rowEnd.getTime(),
    })
  }

  // Longer bars first, then earlier start, then id for stability
  pending.sort((a, b) => {
    if (a.startIndex !== b.startIndex) return a.startIndex - b.startIndex
    if (a.span !== b.span) return b.span - a.span
    return a.event.id.localeCompare(b.event.id)
  })

  // Greedy lane assignment: first lane with no overlap
  const lanes: PendingSegment[][] = []
  const segments: AllDaySegment[] = []

  for (const segment of pending) {
    let lane = 0
    while (true) {
      const occupied = lanes[lane]
      const overlaps = occupied?.some(
        (other) =>
          segment.startIndex < other.startIndex + other.span &&
          other.startIndex < segment.startIndex + segment.span,
      )
      if (!overlaps) break
      lane++
    }
    if (!lanes[lane]) lanes[lane] = []
    lanes[lane].push(segment)
    segments.push({ ...segment, lane })
  }

  return segments
}

export function getEventTimesForDay(
  event: CalendarEvent,
  day: Date,
): EventTimeRange | null {
  const start = new Date(event.startDate)
  const end = new Date(event.endDate)

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null

  const isMultiDay = isMultiDayEvent(start, end)

  let dayStart = start
  let dayEnd = end

  if (isMultiDay) {
    if (!isSameDay(start, day)) {
      dayStart = new Date(day)
      dayStart.setHours(0, 0, 0, 0)
    }

    if (!isSameDay(end, day)) {
      dayEnd = new Date(day)
      dayEnd.setHours(23, 59, 59, 999)
    }
  }

  return EventTimeRange.create({ start: dayStart, end: dayEnd, isMultiDay })
}

export function separateEvents(
  dayEvents: CalendarEvent[],
  _day: Date,
): { allDayEvents: CalendarEvent[]; regularEvents: CalendarEvent[] } {
  const allDayEvents: CalendarEvent[] = []
  const regularEvents: CalendarEvent[] = []

  dayEvents.forEach((event) => {
    // Banner events (explicit all-day, or timed multi-day covering at least
    // one full calendar day) live in the all-day area, not the time grid.
    if (isBannerEvent(event)) {
      allDayEvents.push(event)
    } else {
      regularEvents.push(event)
    }
  })

  return { allDayEvents, regularEvents }
}

export function layoutEventsForDay(
  dayEvents: CalendarEvent[],
  day: Date,
): LayoutEvent[] {
  if (!dayEvents || dayEvents.length === 0) return []

  const { regularEvents } = separateEvents(dayEvents, day)

  const eventsWithTimes = regularEvents
    .map((event) => {
      const times = getEventTimesForDay(event, day)
      if (!times) return null
      return { event, ...times }
    })
    .filter(Boolean) as Array<{
    event: CalendarEvent
    start: Date
    end: Date
    isMultiDay: boolean
  }>

  eventsWithTimes.sort((a, b) => a.start.getTime() - b.start.getTime())

  type TimePoint = { time: number; isStart: boolean; eventIndex: number }
  const timePoints: TimePoint[] = []

  eventsWithTimes.forEach((eventWithTime, index) => {
    const startTime = eventWithTime.start.getTime()
    const endTime = eventWithTime.end.getTime()

    timePoints.push({ time: startTime, isStart: true, eventIndex: index })
    timePoints.push({ time: endTime, isStart: false, eventIndex: index })
  })

  timePoints.sort((a, b) => {
    if (a.time === b.time) {
      return a.isStart ? 1 : -1
    }
    return a.time - b.time
  })

  const eventLayouts: LayoutEvent[] = []
  const activeEvents = new Set<number>()
  const eventToColumn = new Map<number, number>()

  for (let i = 0; i < timePoints.length; i++) {
    const point = timePoints[i]

    if (point.isStart) {
      activeEvents.add(point.eventIndex)

      let column = 0
      const usedColumns = new Set<number>()

      activeEvents.forEach((eventIndex) => {
        if (eventToColumn.has(eventIndex)) {
          usedColumns.add(eventToColumn.get(eventIndex)!)
        }
      })

      while (usedColumns.has(column)) {
        column++
      }

      eventToColumn.set(point.eventIndex, column)
    } else {
      activeEvents.delete(point.eventIndex)
    }

    if (i === timePoints.length - 1 || timePoints[i + 1].time !== point.time) {
      const totalColumns =
        activeEvents.size > 0
          ? Math.max(
              ...Array.from(activeEvents).map((idx) => eventToColumn.get(idx)!),
            ) + 1
          : 0

      activeEvents.forEach((eventIndex) => {
        const column = eventToColumn.get(eventIndex)!
        const { event, start, end, isMultiDay } = eventsWithTimes[eventIndex]

        const existingLayout = eventLayouts.find(
          (layout) => layout.event.id === event.id,
        )

        if (!existingLayout) {
          eventLayouts.push({
            event,
            start,
            end,
            column,
            totalColumns: Math.max(totalColumns, 1),
            isMultiDay,
          })
        }
      })
    }
  }

  return eventLayouts
}

export function snapToQuarterHour(minutes: number): number {
  const clamped = Math.min(Math.max(minutes, 0), 24 * 60)
  return Math.round(clamped / 15) * 15
}

export function formatTimeForDisplay(
  hour: number,
  minute: number,
  timeFormat: TimeFormat,
): string {
  if (timeFormat.is12Hour()) {
    const period = hour >= 12 ? 'PM' : 'AM'
    const twelveHour = hour % 12 || 12
    return `${twelveHour}:${minute.toString().padStart(2, '0')} ${period}`
  }
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
}

export function formatHourMinute(
  hour: number,
  minute: number,
  timeFormat: TimeFormat,
): string {
  if (timeFormat.is12Hour()) {
    const period = hour >= 12 ? 'PM' : 'AM'
    const twelveHour = hour % 12 || 12
    return `${twelveHour}:${minute.toString().padStart(2, '0')} ${period}`
  }
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
}

export function formatDateWithTimezone(
  date: Date,
  language: Language,
  timeFormat: TimeFormat,
  timezone: string,
): string {
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: timeFormat.is12Hour(),
    timeZone: timezone,
  }
  return new Intl.DateTimeFormat(language.code, options).format(date)
}
