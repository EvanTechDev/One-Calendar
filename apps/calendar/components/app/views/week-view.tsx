'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  add,
  addDays,
  startOfDay,
} from 'date-fns'
import { cn } from '@zntr/utils'
import { translations } from '@zntr/i18n/calendar'
import type { CalendarEvent } from '@/lib/calendar-types'
import type { ViewConfig } from '@/lib/calendar-types'
import {
  formatSelectionRange,
  clampRangeToDay,
} from '@/components/app/views/selection-range'
import {
  getEventAccentColor,
  getEventBackgroundColor,
} from '@/lib/event-colors'
import { isTouchInteraction } from '@/lib/mobile-viewport'
import {
  EventLayoutEngine as EventLayoutEngineClass,
  isBannerEvent,
  layoutAllDaySegments,
} from '@/components/app/views/event-layout-engine'
import { useEventResize } from '@/hooks/use-event-resize'
import { eventsOnDay, useEventsByDay } from '@/hooks/use-events-by-day'
import { fromCalendarDate, toCalendarDate } from '@/lib/zoned-date'

interface WeekViewProps {
  date: Date
  events: CalendarEvent[]
  onEventClick: (
    event: CalendarEvent,
    anchorEl?: HTMLElement | null,
    clientX?: number,
    clientY?: number,
  ) => void
  onTimeSlotClick: (startDate: Date, endDate?: Date) => void
  /**
   * A day's header — its weekday name and date chip — was clicked: show that
   * day in the day view.
   *
   * The whole pair is one control because it reads as one unit. The target is
   * the inline box holding them rather than the grid column, so the empty
   * column space beside them still belongs to the grid.
   */
  onDayHeaderClick: (day: Date) => void
  config: ViewConfig
  onEventDrop?: (
    event: CalendarEvent,
    newStartDate: Date,
    newEndDate: Date,
  ) => void
  daysToShow?: number
  fixedStartDate?: Date
  onEditEvent?: (event: CalendarEvent) => void
  onDeleteEvent?: (event: CalendarEvent) => void
  onBookmarkEvent?: (event: CalendarEvent) => void
  /**
   * Range the event editor is being opened for. Rendered as the same blue box
   * as a live drag — it is the editor popover's anchor (CORE-191) — and
   * disappears when the editor closes and the range is cleared.
   */
  selection?: { start: Date; end: Date } | null
}

/** Loop-invariant: the hour rows a day column renders. */
const HOURS = Array.from({ length: 24 }, (_, i) => i)

export default function WeekView({
  date,
  events,
  onEventClick,
  onTimeSlotClick,
  onDayHeaderClick,
  config,
  onEventDrop,
  daysToShow,
  fixedStartDate,
  onEditEvent: _onEditEvent,
  onDeleteEvent: _onDeleteEvent,
  onBookmarkEvent: _onBookmarkEvent,
  selection = null,
}: WeekViewProps) {
  const layoutEngine = useMemo(
    () => EventLayoutEngineClass.create(config),
    [config],
  )

  // One index of events by day for the whole grid, instead of a full scan of
  // the event list per day cell.
  const eventsByDay = useEventsByDay(events, config.timezone)

  /**
   * Memoised because `weekDays` is a dependency of the drag, selection and
   * scroll effects further down. Built inline it was a fresh array every
   * render, so all three tore down and re-registered their document listeners
   * on every render — including once per `setDragPreview`, which is ~60 times a
   * second mid-drag.
   */
  const weekDays = useMemo(() => {
    const firstDay = fixedStartDate ?? date
    if (daysToShow) {
      return Array.from({ length: daysToShow }, (_, index) =>
        addDays(startOfDay(firstDay), index),
      )
    }
    const weekStart = startOfWeek(firstDay, {
      weekStartsOn: config.firstDayOfWeek.value,
    })
    return eachDayOfInterval({
      start: weekStart,
      end: endOfWeek(firstDay, {
        weekStartsOn: config.firstDayOfWeek.value,
      }),
    })
  }, [date, daysToShow, fixedStartDate, config.firstDayOfWeek.value])
  const TIME_GUTTER_WIDTH = 84
  // The gutter is a CSS variable with the desktop constant as fallback: on
  // desktop the variable is never set, so the resolved value is 84px exactly
  // as before. The Mobile Form sets --wv-gutter on the root (ADR-0019) to
  // reclaim width for the seven day columns.
  const gridTemplateColumns = `var(--wv-gutter, ${TIME_GUTTER_WIDTH}px) repeat(${weekDays.length}, minmax(0, 1fr))`
  const t = translations[config.language.code as keyof typeof translations]

  const [currentTime, setCurrentTime] = useState(new Date())
  const today = toCalendarDate(currentTime, config.timezone)
  const calendarSelection = selection
    ? {
        start: toCalendarDate(selection.start, config.timezone),
        end: toCalendarDate(selection.end, config.timezone),
      }
    : null
  const scrolledTimezoneRef = useRef<string | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // The time grid is the scroll container; when its scrollbar shows, its
  // content is narrower than the fixed header above. Pad the header by the
  // scrollbar width so both grids share the same column tracks.
  const [scrollbarWidth, setScrollbarWidth] = useState(0)
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const update = () => setScrollbarWidth(el.offsetWidth - el.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const [draggingEvent, setDraggingEvent] = useState<CalendarEvent | null>(null)
  const [dragStartPosition, setDragStartPosition] = useState<{
    x: number
    y: number
  } | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(
    null,
  )
  const [dragPreview, setDragPreview] = useState<{
    day: Date
    hour: number
    minute: number
  } | null>(null)
  const [dragEventDuration, setDragEventDuration] = useState<number>(0)
  const dragOffsetMinutesRef = useRef(0)
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ignoreNextEventClickRef = useRef(false)
  const isDraggingRef = useRef(false)

  /**
   * Day-column centres and the grid's content-space top edge, measured once and
   * reused for every `mousemove` of a drag.
   *
   * Asking the DOM for these inside the handler meant one `getBoundingClientRect`
   * on the container plus one per day column — eight synchronous layouts per
   * pointer event, ~480 a second mid-drag — and the handler then wrote state, so
   * the next move read against layout the previous one had invalidated. That is
   * what made the drop preview stutter on long weeks.
   *
   * The measurement is keyed on the only things that can move a column: the
   * container's own horizontal scroll offset and its size. Vertical scrolling
   * needs no invalidation — `clientY - top + scrollTop` is already a
   * content-space coordinate, so the two terms move together.
   */
  const dragGeometryRef = useRef<{
    columnCentersX: number[]
    contentTop: number
    scrollLeft: number
    clientWidth: number
    clientHeight: number
  } | null>(null)

  const readDragGeometry = () => {
    const container = scrollContainerRef.current
    if (!container) return null

    const cached = dragGeometryRef.current
    if (
      cached &&
      cached.scrollLeft === container.scrollLeft &&
      cached.clientWidth === container.clientWidth &&
      cached.clientHeight === container.clientHeight
    ) {
      return cached
    }

    const columnCentersX = Array.from(
      container.querySelectorAll('.grid-col'),
    ).map((item) => {
      const rect = item.getBoundingClientRect()
      return rect.left + rect.width / 2
    })
    const geometry = {
      columnCentersX,
      // Content space, so the caller does not have to add `scrollTop` itself.
      contentTop: container.getBoundingClientRect().top - container.scrollTop,
      scrollLeft: container.scrollLeft,
      clientWidth: container.clientWidth,
      clientHeight: container.clientHeight,
    }
    dragGeometryRef.current = geometry
    return geometry
  }

  const queueIgnoreEventClick = () => {
    ignoreNextEventClickRef.current = true
    window.setTimeout(() => {
      ignoreNextEventClickRef.current = false
    }, 0)
  }

  const [createSelection, setCreateSelection] = useState<{
    dayIndex: number
    startMinute: number
    endMinute: number
  } | null>(null)
  const createStartRef = useRef<{ dayIndex: number; minute: number } | null>(
    null,
  )
  const isCreatingRef = useRef(false)
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')

  useEffect(() => {
    if (
      scrolledTimezoneRef.current !== config.timezone &&
      scrollContainerRef.current
    ) {
      const now = toCalendarDate(new Date(), config.timezone)
      scrollContainerRef.current.scrollTo({
        top: Math.max(0, now.getHours() * 60 + now.getMinutes() - 100),
        behavior: 'auto',
      })
      scrolledTimezoneRef.current = config.timezone
    }
  }, [date, weekDays, config.timezone])

  useEffect(() => {
    setCurrentTime(new Date())

    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (
        draggingEvent &&
        isDraggingRef.current &&
        dragStartPosition &&
        scrollContainerRef.current
      ) {
        const geometry = readDragGeometry()
        if (!geometry) return

        let closestDayIndex = 0
        let minDistance = Infinity

        for (let index = 0; index < geometry.columnCentersX.length; index++) {
          const distance = Math.abs(e.clientX - geometry.columnCentersX[index])
          if (distance < minDistance) {
            minDistance = distance
            closestDayIndex = index
          }
        }

        const relativeY = e.clientY - geometry.contentTop
        const positionMinutes = snapToQuarterHour(relativeY)
        const startMinutes = snapToQuarterHour(
          positionMinutes - dragOffsetMinutesRef.current,
        )
        const hour = Math.floor(startMinutes / 60)
        const minute = startMinutes % 60

        if (closestDayIndex < weekDays.length) {
          setDragPreview({
            day: weekDays[closestDayIndex],
            hour: hour,
            minute: minute,
          })
        }
      }
    }

    const handleMouseUp = () => {
      if (
        draggingEvent &&
        isDraggingRef.current &&
        dragPreview &&
        onEventDrop
      ) {
        const wallStart = new Date(dragPreview.day)
        wallStart.setHours(dragPreview.hour, dragPreview.minute, 0, 0)
        const newStartDate = draggingEvent.isAllDay
          ? wallStart
          : fromCalendarDate(wallStart, config.timezone)

        const newEndDate = add(newStartDate, { minutes: dragEventDuration })

        onEventDrop(draggingEvent, newStartDate, newEndDate)
      }

      // The browser fires `click` AFTER `mouseup`, so clearing the drag flag
      // here would let the event block's onClick open the preview at the drop
      // target. Suppress that one click instead (same mechanism the resize
      // handles and the context menu use).
      if (isDraggingRef.current) queueIgnoreEventClick()
      isDraggingRef.current = false
      dragGeometryRef.current = null
      setDraggingEvent(null)
      setDragStartPosition(null)
      setDragOffset(null)
      setDragPreview(null)
    }

    if (draggingEvent) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [
    draggingEvent,
    dragStartPosition,
    dragPreview,
    onEventDrop,
    weekDays,
    dragEventDuration,
    config.timezone,
  ])

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isCreatingRef.current || !createStartRef.current) return
      const endMinute = getMinutesFromMousePosition(event.clientY)
      setCreateSelection({
        dayIndex: createStartRef.current.dayIndex,
        startMinute: createStartRef.current.minute,
        endMinute,
      })
    }

    const handleMouseUp = () => {
      if (!isCreatingRef.current || !createStartRef.current) return

      const { dayIndex, minute } = createStartRef.current
      const startMinute = Math.min(minute, createSelection?.endMinute ?? minute)
      const endMinute = Math.max(minute, createSelection?.endMinute ?? minute)
      const day = weekDays[dayIndex]

      if (day) {
        const startDate = new Date(day)
        startDate.setHours(0, startMinute, 0, 0)

        const effectiveEndMinute =
          endMinute === startMinute ? startMinute + 30 : endMinute
        const endDate = new Date(day)
        endDate.setHours(0, Math.min(effectiveEndMinute, 24 * 60), 0, 0)

        onTimeSlotClick(
          fromCalendarDate(startDate, config.timezone),
          fromCalendarDate(endDate, config.timezone),
        )
      }

      isCreatingRef.current = false
      createStartRef.current = null
      setCreateSelection(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [createSelection, onTimeSlotClick, weekDays, config.timezone])

  const formatTime = (hour: number) => {
    if (config.timeFormat.is12Hour()) {
      const period = hour >= 12 ? 'PM' : 'AM'
      const twelveHour = hour % 12 || 12
      return `${twelveHour} ${period}`
    }
    return `${hour.toString().padStart(2, '0')}:00`
  }

  const formatHourMinute = (hour: number, minute: number) => {
    if (config.timeFormat.is12Hour()) {
      const period = hour >= 12 ? 'PM' : 'AM'
      const twelveHour = hour % 12 || 12
      return `${twelveHour}:${minute.toString().padStart(2, '0')} ${period}`
    }
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
  }

  const handleEventDragStart = (event: CalendarEvent, e: React.MouseEvent) => {
    if (event.viewOnly) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    // Touch (ADR-0019): dragging events with a finger fights scrolling, so
    // it is disabled — but the mousedown must not bubble to the grid, or the
    // tap-to-create path fires underneath and buries the preview the
    // subsequent click opens. Mouse drags keep working at every width.
    if (isTouchInteraction()) {
      e.stopPropagation()
      return
    }
    e.preventDefault()
    e.stopPropagation()

    longPressTimeoutRef.current = setTimeout(() => {
      const start = new Date(event.startDate)
      const end = new Date(event.endDate)

      const durationMs = end.getTime() - start.getTime()
      const durationMinutes = Math.round(durationMs / (1000 * 60))

      let offsetMinutes = 0
      if (!event.isAllDay) {
        const wallStart = toCalendarDate(start, config.timezone)
        const eventStartMinutes =
          wallStart.getHours() * 60 + wallStart.getMinutes()
        offsetMinutes =
          getMinutesFromMousePosition(e.clientY) - eventStartMinutes
      }
      dragOffsetMinutesRef.current = offsetMinutes

      setDraggingEvent(event)
      setDragStartPosition({ x: e.clientX, y: e.clientY })
      setDragEventDuration(durationMinutes)
      isDraggingRef.current = true
    }, 300)
  }

  const handleEventDragEnd = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current)
      longPressTimeoutRef.current = null
    }
  }

  const snapToQuarterHour = (minutes: number) => {
    const clamped = Math.min(Math.max(minutes, 0), 24 * 60)
    return Math.round(clamped / 15) * 15
  }

  const getMinutesFromMousePosition = (clientY: number) => {
    if (!scrollContainerRef.current) return 0
    const containerRect = scrollContainerRef.current.getBoundingClientRect()
    return snapToQuarterHour(
      clientY - containerRect.top + scrollContainerRef.current.scrollTop,
    )
  }

  const {
    resize,
    beginResize,
    suppressClickRef: suppressResizeClickRef,
  } = useEventResize({
    onEventDrop,
    getMinutesFromMousePosition,
    timeZone: config.timezone,
  })

  const handleGridMouseDown = (
    dayIndex: number,
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0 || draggingEvent) return

    // Touch (ADR-0019): a finger on an empty slot must scroll, not start a
    // selection — a tap creates a default-length draft at that time instead.
    // Mouse drag-to-create keeps working at every width.
    if (isTouchInteraction()) {
      const day = weekDays[dayIndex]
      if (day) {
        const startMinute = getMinutesFromMousePosition(event.clientY)
        const startDate = new Date(day)
        startDate.setHours(0, startMinute, 0, 0)
        const endDate = new Date(day)
        endDate.setHours(0, Math.min(startMinute + 30, 24 * 60), 0, 0)
        onTimeSlotClick(
          fromCalendarDate(startDate, config.timezone),
          fromCalendarDate(endDate, config.timezone),
        )
      }
      return
    }

    const startMinute = getMinutesFromMousePosition(event.clientY)
    createStartRef.current = { dayIndex, minute: startMinute }
    isCreatingRef.current = true
    setCreateSelection({ dayIndex, startMinute, endMinute: startMinute })
  }

  const ALL_DAY_BAR_HEIGHT = 20
  const ALL_DAY_BAR_GAP = 2
  const ALL_DAY_BAR_INSET = 2

  const allDaySegments = layoutAllDaySegments(
    events.filter((event) => isBannerEvent(event, config.timezone)),
    weekDays,
    config.timezone,
  )
  const allDayLaneCount =
    allDaySegments.length > 0
      ? Math.max(...allDaySegments.map((s) => s.lane)) + 1
      : 0
  const allDayRowHeight =
    allDayLaneCount > 0
      ? allDayLaneCount * (ALL_DAY_BAR_HEIGHT + ALL_DAY_BAR_GAP) +
        ALL_DAY_BAR_GAP
      : 0

  const renderAllDaySegments = () =>
    allDaySegments.map((segment) => {
      const { event, startIndex, span, lane } = segment
      const leftInset = segment.continuesLeft ? 0 : ALL_DAY_BAR_INSET
      const rightInset = segment.continuesRight ? 0 : ALL_DAY_BAR_INSET

      return (
        <div
          key={`allday-${event.id}`}
          data-event-id={event.id}
          className={cn(
            'absolute rounded-md p-1 text-xs cursor-pointer overflow-hidden',
            event.color,
            segment.continuesLeft && 'rounded-l-none',
            segment.continuesRight && 'rounded-r-none',
          )}
          style={{
            top: lane * (ALL_DAY_BAR_HEIGHT + ALL_DAY_BAR_GAP) + 'px',
            left: `calc(${startIndex} / ${weekDays.length} * 100% + ${leftInset}px)`,
            width: `calc(${span} / ${weekDays.length} * 100% - ${leftInset + rightInset}px)`,
            height: ALL_DAY_BAR_HEIGHT + 'px',
            opacity: isDark ? 1 : 0.9,
            backgroundColor: getEventBackgroundColor(event.color, isDark),
            zIndex: 10 + lane,
          }}
          onMouseDown={(e) => handleEventDragStart(event, e)}
          onMouseUp={handleEventDragEnd}
          onMouseLeave={handleEventDragEnd}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            queueIgnoreEventClick()
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (ignoreNextEventClickRef.current) return
            if (!isDraggingRef.current) {
              onEventClick(
                event,
                e.currentTarget as HTMLElement,
                e.clientX,
                e.clientY,
              )
            }
          }}
        >
          {!segment.continuesLeft && (
            <div
              className={cn('absolute left-0 top-0 w-1 h-full rounded-l-sm')}
              style={{ backgroundColor: getEventAccentColor(event.color) }}
            />
          )}
          <div
            className="pl-1.5 truncate"
            style={{ color: getEventAccentColor(event.color) }}
          >
            {event.title}
          </div>
        </div>
      )
    })

  const renderDragPreview = () => {
    if (!dragPreview || !draggingEvent) return null

    const dayIndex = weekDays.findIndex((day) =>
      isSameDay(day, dragPreview.day),
    )
    if (dayIndex === -1) return null

    const startMinutes = dragPreview.hour * 60 + dragPreview.minute
    const endMinutes = startMinutes + dragEventDuration

    return (
      <div
        className={cn(
          'absolute rounded-md p-2 text-sm cursor-pointer overflow-hidden',
          draggingEvent.color,
        )}
        style={{
          top: `${startMinutes}px`,
          height: `${dragEventDuration}px`,
          opacity: 0.6,
          width: `calc(100% - 4px)`,
          left: '2px',
          zIndex: 100,
          border: '2px dashed white',
          backgroundColor: getEventBackgroundColor(
            draggingEvent?.color,
            isDark,
          ),
          pointerEvents: 'none',
        }}
      >
        <div
          className={cn('absolute left-0 top-0 w-1 h-full rounded-l-sm')}
          style={{ backgroundColor: getEventAccentColor(draggingEvent.color) }}
        />
        <div className="pl-1">
          <div
            className="font-medium leading-tight break-words"
            style={{
              color: getEventAccentColor(draggingEvent.color),
              // Match the real block: wrap to as many lines as the preview's
              // height allows instead of always truncating to one line.
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: Math.max(
                1,
                Math.floor((dragEventDuration - 8) / 16),
              ),
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {draggingEvent.title}
          </div>
          {dragEventDuration >= 40 && (
            <div className="text-xs text-white/90 truncate">
              {formatHourMinute(dragPreview.hour, dragPreview.minute)} -{' '}
              {formatHourMinute(Math.floor(endMinutes / 60), endMinutes % 60)}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full max-md:[--wv-gutter:3rem] max-md:text-xs">
      <div
        className="relative z-30 bg-background border-b"
        style={{ paddingRight: scrollbarWidth + 'px' }}
      >
        {/* One grid holds both the weekday header and the all-day area, so
            the divide-x lines run through both and always match. */}
        <div className="relative">
          <div className="grid divide-x" style={{ gridTemplateColumns }}>
            <div className="relative text-sm text-muted-foreground max-md:text-[10px]">
              {allDayRowHeight > 0 && (
                <span
                  className="absolute right-3 max-md:right-1.5 max-md:truncate max-md:max-w-full"
                  style={{ bottom: allDayRowHeight - 20 + 'px' }}
                >
                  {t.allDay}
                </span>
              )}
            </div>
            {weekDays.map((day) => (
              <div key={day.toString()}>
                <div className="p-2 text-center max-md:p-1">
                  <div
                    className="flex min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-accent max-md:gap-1"
                    role="button"
                    tabIndex={0}
                    // Weekday name and date chip are the same control, so the
                    // name is the long one; the chip's own "15" would be a
                    // useless label on its own.
                    aria-label={format(day, 'PPPP')}
                    onClick={() => onDayHeaderClick(day)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onDayHeaderClick(day)
                      }
                    }}
                  >
                    <div className="min-w-0 truncate">
                      {t.weekdays[day.getDay()]}
                    </div>
                    <div
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center text-sm',
                        isSameDay(day, today) &&
                          'rounded-md bg-cal-today text-cal-today-foreground',
                      )}
                    >
                      {format(day, 'd')}
                    </div>
                  </div>
                </div>
                {allDayRowHeight > 0 && (
                  <div style={{ height: allDayRowHeight + 'px' }} />
                )}
              </div>
            ))}
          </div>

          {allDayRowHeight > 0 && (
            <div
              className="absolute bottom-0 right-0"
              style={{
                left: `var(--wv-gutter, ${TIME_GUTTER_WIDTH}px)`,
                height: allDayRowHeight + 'px',
              }}
            >
              {renderAllDaySegments()}
            </div>
          )}
        </div>
      </div>

      <div
        className="flex-1 grid divide-x overflow-auto"
        style={{ gridTemplateColumns }}
        ref={scrollContainerRef}
      >
        <div className="text-sm text-muted-foreground max-md:text-[10px]">
          {HOURS.map((hour) => (
            <div key={hour} className="h-[60px] relative border-gray-200">
              <span
                className={cn(
                  'absolute right-3 max-md:right-1.5',
                  hour === 0 ? 'top-0' : 'top-0 -translate-y-1/2',
                )}
              >
                {formatTime(hour)}
              </span>
            </div>
          ))}
        </div>

        {weekDays.map((day, dayIndex) => {
          const dayEvents = eventsOnDay(eventsByDay, day)

          const { regularEvents } = layoutEngine.separateEvents(dayEvents, day)

          const eventLayouts = layoutEngine.layoutEventsForDay(
            regularEvents,
            day,
          )

          return (
            <div
              key={day.toString()}
              className="relative grid-col select-none"
              onMouseDown={(event) => handleGridMouseDown(dayIndex, event)}
            >
              {HOURS.map((hour) => (
                <div key={hour} className="h-[60px] border-t" />
              ))}

              {eventLayouts.map(
                ({ event, start, end, column, totalColumns, isMultiDay }) => {
                  const startMinutes =
                    start.getHours() * 60 + start.getMinutes()
                  const endMinutes = end.getHours() * 60 + end.getMinutes()
                  const isResizing = resize?.event.id === event.id
                  const displayStart = isResizing
                    ? resize.liveStart
                    : startMinutes
                  const displayEnd = isResizing ? resize.liveEnd : endMinutes
                  const renderStart = displayStart
                  const renderEnd = displayEnd
                  const duration = renderEnd - renderStart
                  const displayStartDate = new Date(start)
                  displayStartDate.setHours(0, renderStart, 0, 0)
                  const displayEndDate = new Date(start)
                  displayEndDate.setHours(0, renderEnd, 0, 0)

                  const minHeight = 20
                  const height = Math.max(duration, minHeight)

                  const width = `calc((100% - 4px) / ${totalColumns})`
                  const left = `calc(${column} * ${width})`

                  const canResize =
                    !event.viewOnly &&
                    !isMultiDay &&
                    !isResizing &&
                    endMinutes >= startMinutes

                  return (
                    <div
                      key={`${event.id}-${day.toISOString().split('T')[0]}`}
                      data-event-id={event.id}
                      className={cn(
                        'relative absolute rounded-md p-2 text-sm cursor-pointer overflow-hidden',
                        event.color,
                      )}
                      style={{
                        top: `${renderStart}px`,
                        height: `${height}px`,
                        opacity: isDark ? 1 : 0.92,
                        backgroundColor: getEventBackgroundColor(
                          event.color,
                          isDark,
                        ),
                        width,
                        left,
                        zIndex: column + 1,
                      }}
                      onMouseDown={(e) => handleEventDragStart(event, e)}
                      onMouseUp={handleEventDragEnd}
                      onMouseLeave={handleEventDragEnd}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (ignoreNextEventClickRef.current) return
                        if (suppressResizeClickRef.current) return
                        if (!isDraggingRef.current) {
                          onEventClick(
                            event,
                            e.currentTarget as HTMLElement,
                            e.clientX,
                            e.clientY,
                          )
                        }
                      }}
                    >
                      {canResize && (
                        <>
                          <div
                            className="absolute left-0 right-0 top-0 z-10 h-1.5 cursor-ns-resize rounded-t-md"
                            onMouseDown={(e) =>
                              beginResize(
                                event,
                                'start',
                                e,
                                start,
                                startMinutes,
                                endMinutes,
                              )
                            }
                          />
                          <div
                            className="absolute bottom-0 left-0 right-0 z-10 h-1.5 cursor-ns-resize rounded-b-md"
                            onMouseDown={(e) =>
                              beginResize(
                                event,
                                'end',
                                e,
                                start,
                                startMinutes,
                                endMinutes,
                              )
                            }
                          />
                        </>
                      )}
                      <div
                        className={cn(
                          'absolute left-0 top-0 w-1 h-full rounded-l-sm',
                        )}
                        style={{
                          backgroundColor: getEventAccentColor(event.color),
                        }}
                      />
                      <div className="pl-1">
                        <div
                          className="font-medium leading-tight break-words"
                          style={{
                            color: getEventAccentColor(event.color),
                            display: '-webkit-box',
                            WebkitBoxOrient: 'vertical',
                            WebkitLineClamp: Math.max(
                              1,
                              Math.floor((height - 8) / 16),
                            ),
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {event.title}
                        </div>
                        {height >= 40 && (
                          <div
                            className="text-xs truncate"
                            style={{
                              color: getEventAccentColor(event.color),
                            }}
                          >
                            {formatHourMinute(
                              displayStartDate.getHours(),
                              displayStartDate.getMinutes(),
                            )}{' '}
                            -{' '}
                            {formatHourMinute(
                              displayEndDate.getHours(),
                              displayEndDate.getMinutes(),
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                },
              )}

              {createSelection && createSelection.dayIndex === dayIndex && (
                <div
                  data-create-selection
                  className="absolute left-0 right-0 rounded-md border border-cal-accent/40 bg-cal-accent/10 pointer-events-none"
                  style={{
                    top: `${Math.min(createSelection.startMinute, createSelection.endMinute)}px`,
                    height: `${Math.max(Math.abs(createSelection.endMinute - createSelection.startMinute), 15)}px`,
                    zIndex: 5,
                  }}
                >
                  {/* `cal-accent-ink`, not `cal-accent`: an identity colour
                      is tuned to read as a hue, and yellow on white is 1.53:1. */}
                  <div className="px-2 pt-1 text-xs font-medium text-cal-accent-ink">
                    {formatSelectionRange(
                      createSelection.startMinute,
                      createSelection.endMinute,
                      formatHourMinute,
                    )}
                  </div>
                </div>
              )}

              {/* The editor's anchor: the committed/draft range, kept visible
                  while the editor popover is open (CORE-191) and following
                  the editor's date-time fields. A multi-day range renders a
                  clamped slice per visible day column; days outside this
                  period simply produce no slice. */}
              {calendarSelection &&
                !createSelection &&
                (() => {
                  const slice = clampRangeToDay(calendarSelection, day)
                  if (!slice) return null
                  const { startMinute, endMinute } = slice
                  // Anchor the editor to the first *visible* slice — when the
                  // range starts before this period, its true start day is
                  // not on screen.
                  const firstVisibleIndex = weekDays.findIndex(
                    (d) => clampRangeToDay(calendarSelection, d) !== null,
                  )
                  const isFirstDay = dayIndex === firstVisibleIndex
                  return (
                    <div
                      {...(isFirstDay ? { 'data-create-selection': true } : {})}
                      className="absolute left-0 right-0 rounded-md border border-cal-accent/40 bg-cal-accent/10 pointer-events-none"
                      style={{
                        top: `${startMinute}px`,
                        height: `${Math.max(endMinute - startMinute, 15)}px`,
                        zIndex: 5,
                      }}
                    >
                      {/* `cal-accent-ink`, not `cal-accent`: an identity colour
                          is tuned to read as a hue, and yellow on white is 1.53:1. */}
                      <div className="px-2 pt-1 text-xs font-medium text-cal-accent-ink">
                        {formatSelectionRange(
                          startMinute,
                          endMinute,
                          formatHourMinute,
                        )}
                      </div>
                    </div>
                  )
                })()}

              {}
              {dragPreview &&
                isSameDay(dragPreview.day, day) &&
                renderDragPreview()}

              {isSameDay(day, today) &&
                (() => {
                  const currentHours = today.getHours()
                  const currentMinutes = today.getMinutes()

                  const topPosition = currentHours * 60 + currentMinutes

                  return (
                    <div
                      className="absolute left-0 right-0 border-t-2 border-cal-now z-30 pointer-events-none"
                      style={{
                        top: `${topPosition}px`,
                      }}
                    >
                      <span className="absolute -left-[5px] -top-[6px] h-2.5 w-2.5 rounded-full bg-cal-now" />
                    </div>
                  )
                })()}
            </div>
          )
        })}
      </div>

      {}
      {draggingEvent && (
        <div
          className="fixed px-2 py-1 bg-black text-white rounded-md text-xs z-50 pointer-events-none"
          style={{
            left: dragOffset
              ? dragStartPosition!.x + dragOffset.x + 10
              : dragStartPosition!.x + 10,
            top: dragOffset
              ? dragStartPosition!.y + dragOffset.y + 10
              : dragStartPosition!.y + 10,
            opacity: 0.8,
          }}
        >
          {t.dragToNewPosition}
        </div>
      )}
    </div>
  )
}
