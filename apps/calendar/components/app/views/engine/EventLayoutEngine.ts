'use client'

import { isWithinInterval, isSameDay } from 'date-fns'
import type { CalendarEvent } from '@/components/app/calendar'
import {
  Language,
  TimeFormat,
  ViewConfig,
  EventTimeRange,
} from '@/components/app/calendar-types'

export interface LayoutEvent {
  event: CalendarEvent
  start: Date
  end: Date
  column: number
  totalColumns: number
  isMultiDay: boolean
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
    const start = new Date(event.startDate)
    const end = new Date(event.endDate)

    if (this.isAllDayEvent(event) && this.isMultiDayEvent(start, end)) {
      return isSameDay(start, day)
    }

    if (isSameDay(start, day)) return true

    if (this.isMultiDayEvent(start, end) && !this.isAllDayEvent(event)) {
      return isWithinInterval(day, { start, end })
    }

    return false
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
        dayStart.setUTCHours(0, 0, 0, 0)
      }

      if (!isSameDay(end, day)) {
        dayEnd = new Date(day)
        dayEnd.setUTCHours(23, 59, 59, 999)
      }
    }

    return EventTimeRange.create({ start: dayStart, end: dayEnd, isMultiDay })
  }

  separateEvents(
    dayEvents: CalendarEvent[],
    _day: Date,
  ): { allDayEvents: CalendarEvent[]; regularEvents: CalendarEvent[] } {
    const allDayEvents: CalendarEvent[] = []
    const regularEvents: CalendarEvent[] = []

    dayEvents.forEach((event) => {
      if (this.isAllDayEvent(event)) {
        allDayEvents.push(event)
      } else {
        regularEvents.push(event)
      }
    })

    return { allDayEvents, regularEvents }
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

export function shouldShowEventOnDay(event: CalendarEvent, day: Date): boolean {
  const start = new Date(event.startDate)
  const end = new Date(event.endDate)

  if (isAllDayEvent(event) && isMultiDayEvent(start, end)) {
    return isSameDay(start, day)
  }

  if (isSameDay(start, day)) return true

  if (isMultiDayEvent(start, end) && !isAllDayEvent(event)) {
    return isWithinInterval(day, { start, end })
  }

  return false
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
      dayStart.setUTCHours(0, 0, 0, 0)
    }

    if (!isSameDay(end, day)) {
      dayEnd = new Date(day)
      dayEnd.setUTCHours(23, 59, 59, 999)
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
    if (isAllDayEvent(event)) {
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
