'use client'

import { isWithinInterval, isSameDay, startOfDay, addDays } from 'date-fns'
import type { CalendarEvent } from '#calendar/lib/calendar-types'
import { toCalendarDate } from '#calendar/lib/zoned-date'
import { Language, TimeFormat, ViewConfig } from '#calendar/lib/calendar-types'

/**
 * A timed event placed in a day column.
 *
 * The horizontal box is a linear form of the column width: the block's left
 * edge is `left * W + leftOffset` px and its width `width * W + widthOffset`
 * px, where `W` is the usable column width. Fractions come from side-by-side
 * placement, the pixel offsets from nesting indents, which must stay a fixed
 * size however wide the column is.
 */
export interface LayoutEvent {
  event: CalendarEvent
  start: Date
  end: Date
  left: number
  leftOffset: number
  width: number
  widthOffset: number
  /** Nesting level; 0 is a block that sits directly on the column. */
  depth: number
  isMultiDay: boolean
}

/**
 * The renderer draws a block at least this many minutes tall (1px per minute),
 * so a shorter event still covers that much of the column. Layout has to treat
 * it as that long, or a 5-minute event and the one after it overlap on screen
 * while being assigned the same column.
 */
export const MIN_VISUAL_MINUTES = 20

/**
 * Events that start less than this far apart are shown side by side. One that
 * starts later is laid over the event already running, indented, so the top
 * of the earlier block — its title and time — stays readable.
 */
export const SIDE_BY_SIDE_MINUTES = 30

/** Horizontal indent of each nesting level, in px. */
export const NEST_INDENT_PX = 12

/** Nesting deeper than this stops indenting further. */
const MAX_INDENT_DEPTH = 4

interface TimedItem {
  event: CalendarEvent
  start: Date
  end: Date
  isMultiDay: boolean
}

interface Box {
  left: number
  leftOffset: number
  width: number
  widthOffset: number
}

/**
 * Lays timed events out the way Google Calendar does.
 *
 * Splitting every overlap into equal columns turns a busy afternoon into a
 * row of slivers, because one long event keeps the whole cluster divided for
 * hours. Instead, events whose starts fall within {@link SIDE_BY_SIDE_MINUTES}
 * of each other form a group and share its area in columns. A group that
 * starts while another event is still running is nested over that event:
 * indented from its left edge, sharing its right edge, and drawn on top. The
 * running event keeps its full width, so only the events that really compete
 * for the same moment get narrower.
 */
export function packTimedEvents(items: TimedItem[]): LayoutEvent[] {
  const minMs = MIN_VISUAL_MINUTES * 60 * 1000
  const groupMs = SIDE_BY_SIDE_MINUTES * 60 * 1000

  const entries = items.map((item) => {
    const start = item.start.getTime()
    const end = Math.max(item.end.getTime(), start + minMs)
    return { item, start, end }
  })

  entries.sort(
    (a, b) =>
      a.start - b.start ||
      b.end - a.end ||
      a.item.event.id.localeCompare(b.item.event.id),
  )

  type Entry = (typeof entries)[number]
  type Placed = { entry: Entry; box: Box; depth: number }

  const placed: Placed[] = []

  for (let i = 0; i < entries.length; ) {
    const groupStart = entries[i].start
    let j = i
    while (j < entries.length && entries[j].start - groupStart < groupMs) j++
    const group = entries.slice(i, j)
    i = j

    // The group nests over the topmost block still running when it starts:
    // the deepest one, and the latest drawn among equals.
    let parent: Placed | undefined
    for (const candidate of placed) {
      if (candidate.entry.end <= groupStart) continue
      if (!parent || candidate.depth >= parent.depth) parent = candidate
    }

    const indent =
      parent && parent.depth < MAX_INDENT_DEPTH ? NEST_INDENT_PX : 0
    const region: Box = parent
      ? {
          left: parent.box.left,
          leftOffset: parent.box.leftOffset + indent,
          width: parent.box.width,
          widthOffset: parent.box.widthOffset - indent,
        }
      : { left: 0, leftOffset: 0, width: 1, widthOffset: 0 }
    const depth = parent ? parent.depth + 1 : 0

    const columnEnds: number[] = []
    const columns = group.map((entry) => {
      let column = columnEnds.findIndex((end) => end <= entry.start)
      if (column === -1) column = columnEnds.length
      columnEnds[column] = entry.end
      return column
    })
    const total = columnEnds.length

    group.forEach((entry, index) => {
      const column = columns[index]
      let span = 1
      while (column + span < total) {
        const next = column + span
        const blocked = group.some(
          (other, otherIndex) =>
            columns[otherIndex] === next &&
            other.start < entry.end &&
            entry.start < other.end,
        )
        if (blocked) break
        span++
      }
      placed.push({
        entry,
        depth,
        box: {
          left: region.left + (region.width * column) / total,
          leftOffset: region.leftOffset + (region.widthOffset * column) / total,
          width: (region.width * span) / total,
          widthOffset: (region.widthOffset * span) / total,
        },
      })
    })
  }

  return placed.map(({ entry, box, depth }) => ({
    event: entry.item.event,
    start: entry.item.start,
    end: entry.item.end,
    ...box,
    depth,
    isMultiDay: entry.item.isMultiDay,
  }))
}

/**
 * CSS position of a laid-out block inside a day column. `gutterPx` stays
 * free at the column's right edge so empty time can still be clicked, and
 * `gapPx` separates neighbouring blocks.
 */
export function layoutBoxStyle(
  layout: Pick<LayoutEvent, keyof Box>,
  gutterPx: number,
  gapPx = 2,
): { left: string; width: string } {
  const base = `(100% - ${gutterPx}px)`
  const round = (value: number) => Number(value.toFixed(4))
  const offset = (px: number) =>
    px < 0 ? ` - ${round(-px)}px` : ` + ${round(px)}px`
  return {
    left: `calc(${base} * ${round(layout.left)}${offset(layout.leftOffset)})`,
    width: `calc(${base} * ${round(layout.width)}${offset(layout.widthOffset - gapPx)})`,
  }
}

// These are grid coordinates, not an elapsed-time interval. In a DST fold
// a valid event can finish at 01:15 after starting at the earlier 01:30.
type GridTimeRange = Pick<LayoutEvent, 'start' | 'end' | 'isMultiDay'>

/** Original events stay as instants; only layout coordinates use wall time. */
export function eventCalendarRange(event: CalendarEvent, timeZone?: string) {
  const start = new Date(event.startDate)
  const end = new Date(event.endDate)
  // Preserve invalid dates for the existing filters; Intl rejects them before
  // the grid can discard the malformed event.
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { start, end }
  return timeZone && !event.isAllDay
    ? {
        start: toCalendarDate(start, timeZone),
        end: toCalendarDate(end, timeZone),
      }
    : { start, end }
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
    return isAllDayEvent(event, this.config.timezone)
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
    return shouldShowEventOnDay(event, day, this.config.timezone)
  }

  layoutAllDaySegments(
    events: CalendarEvent[],
    rowDays: Date[],
  ): AllDaySegment[] {
    return layoutAllDaySegments(events, rowDays, this.config.timezone)
  }

  getEventTimesForDay(event: CalendarEvent, day: Date): GridTimeRange | null {
    return getEventTimesForDay(event, day, this.config.timezone)
  }

  separateEvents(
    dayEvents: readonly CalendarEvent[],
    day: Date,
  ): { allDayEvents: CalendarEvent[]; regularEvents: CalendarEvent[] } {
    return separateEvents(dayEvents, day, this.config.timezone)
  }

  layoutEventsForDay(
    dayEvents: readonly CalendarEvent[],
    day: Date,
  ): LayoutEvent[] {
    if (!dayEvents || dayEvents.length === 0) return []

    const { regularEvents } = this.separateEvents(dayEvents, day)

    const items = regularEvents
      .map((event) => {
        const times = this.getEventTimesForDay(event, day)
        return times ? { event, ...times } : null
      })
      .filter((item): item is TimedItem => item !== null)

    return packTimedEvents(items)
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
export function isAllDayEvent(
  event: CalendarEvent,
  timeZone?: string,
): boolean {
  if (event.isAllDay) return true

  const { start, end } = eventCalendarRange(event, timeZone)

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
export function coversFullCalendarDay(
  event: CalendarEvent,
  timeZone?: string,
): boolean {
  const { start, end } = eventCalendarRange(event, timeZone)
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
export function isBannerEvent(
  event: CalendarEvent,
  timeZone?: string,
): boolean {
  if (isAllDayEvent(event, timeZone)) return true

  const { start, end } = eventCalendarRange(event, timeZone)
  return isMultiDayEvent(start, end) && coversFullCalendarDay(event, timeZone)
}

/**
 * Last calendar day an event visually occupies. An end landing exactly on
 * midnight is treated as exclusive-end (the event occupies up to the
 * previous day) — a bar for 1st 00:00 – 5th 00:00 must not cover the 5th.
 */
function getEventLastDay(event: CalendarEvent, timeZone?: string): Date {
  const { start, end } = eventCalendarRange(event, timeZone)

  if (
    end.getHours() === 0 &&
    end.getMinutes() === 0 &&
    !isSameDay(start, end)
  ) {
    return startOfDay(addDays(end, -1))
  }

  return startOfDay(end)
}

export function shouldShowEventOnDay(
  event: CalendarEvent,
  day: Date,
  timeZone?: string,
): boolean {
  const { start, end } = eventCalendarRange(event, timeZone)

  if (isSameDay(start, day)) return true

  if (isMultiDayEvent(start, end)) {
    // Banner events (all-day, or timed spanning full days) occupy whole
    // calendar days; an end exactly at midnight excludes that day.
    if (isBannerEvent(event, timeZone)) {
      const rangeStart = startOfDay(start)
      const rangeEnd = getEventLastDay(event, timeZone)
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
  timeZone?: string,
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

    const eventStart = startOfDay(eventCalendarRange(event, timeZone).start)
    const eventLastDay = getEventLastDay(event, timeZone)
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

/**
 * How many all-day lanes each day column of a row must reserve space for,
 * indexed by column. `-1` means no bar covers that column at all.
 *
 * Per COLUMN, not per row. The bars are absolutely positioned and each covers
 * only the columns it spans, so reserving the row's tallest lane in every cell
 * opened an empty event-sized slot on every day no bar reached — an all-day
 * event on the 2nd showed a blank slot on the 1st, and on every other day of
 * that week, that read as an event that failed to render.
 *
 * The count is `lane + 1`, not the tallest lane: lanes stack from the top, so
 * a bar in lane 2 needs room for the two lanes above it too.
 */
export function barLanesByColumn(
  segments: AllDaySegment[],
  columnCount: number,
): number[] {
  const lanes = Array.from<number>({ length: columnCount }).fill(-1)

  for (const segment of segments) {
    const start = Math.max(segment.startIndex, 0)
    const end = Math.min(segment.startIndex + segment.span, columnCount)
    for (let column = start; column < end; column++) {
      lanes[column] = Math.max(lanes[column], segment.lane + 1)
    }
  }

  return lanes
}

export function getEventTimesForDay(
  event: CalendarEvent,
  day: Date,
  timeZone?: string,
): GridTimeRange | null {
  const { start, end } = eventCalendarRange(event, timeZone)

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null
  if (new Date(event.endDate) < new Date(event.startDate)) return null

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

  return { start: dayStart, end: dayEnd, isMultiDay }
}

export function separateEvents(
  dayEvents: readonly CalendarEvent[],
  _day: Date,
  timeZone?: string,
): { allDayEvents: CalendarEvent[]; regularEvents: CalendarEvent[] } {
  const allDayEvents: CalendarEvent[] = []
  const regularEvents: CalendarEvent[] = []

  dayEvents.forEach((event) => {
    // Banner events (explicit all-day, or timed multi-day covering at least
    // one full calendar day) live in the all-day area, not the time grid.
    if (isBannerEvent(event, timeZone)) {
      allDayEvents.push(event)
    } else {
      regularEvents.push(event)
    }
  })

  return { allDayEvents, regularEvents }
}

export function layoutEventsForDay(
  dayEvents: readonly CalendarEvent[],
  day: Date,
): LayoutEvent[] {
  if (!dayEvents || dayEvents.length === 0) return []

  const { regularEvents } = separateEvents(dayEvents, day)

  const items = regularEvents
    .map((event) => {
      const times = getEventTimesForDay(event, day)
      return times ? { event, ...times } : null
    })
    .filter((item): item is TimedItem => item !== null)

  return packTimedEvents(items)
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

/**
 * Formatters are cached per `(locale, 12-hour, zone)`.
 *
 * Constructing an `Intl.DateTimeFormat` costs one to two orders of magnitude
 * more than calling `.format()` on it, and this is called twice per rendered
 * event block — so a 100-block week meant 200 constructions on every render,
 * and a render happens on every drag preview, every current-time tick and
 * every save. The `Map` is bounded by the locale × clock-convention × zone
 * cross-product a session actually visits.
 */
const timeFormatterCache = new Map<string, Intl.DateTimeFormat>()

export function formatDateWithTimezone(
  date: Date,
  language: Language,
  timeFormat: TimeFormat,
  timezone: string,
): string {
  const hour12 = timeFormat.is12Hour()
  const key = `${language.code}|${hour12 ? '12' : '24'}|${timezone}`
  let formatter = timeFormatterCache.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(language.code, {
      hour: '2-digit',
      minute: '2-digit',
      hour12,
      timeZone: timezone,
    })
    timeFormatterCache.set(key, formatter)
  }
  return formatter.format(date)
}
