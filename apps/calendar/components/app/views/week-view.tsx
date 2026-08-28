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
import type { CalendarEvent } from '../calendar'
import type { ViewConfig } from '@/lib/calendar-types'
import {
  formatSelectionRange,
  clampRangeToDay,
} from '@/components/app/views/selection-range'
import {
  getEventAccentColor,
  getEventBackgroundColor,
} from '@/lib/event-colors'
import {
  EventLayoutEngine as EventLayoutEngineClass,
  isBannerEvent,
  layoutAllDaySegments,
} from '@/components/app/views/event-layout-engine'
import { useEventResize } from '@/hooks/use-event-resize'

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

export default function WeekView({
  date,
  events,
  onEventClick,
  onTimeSlotClick,
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

  const weekStart = startOfWeek(date, {
    weekStartsOn: config.firstDayOfWeek.value,
  })
  const weekEnd = endOfWeek(date, { weekStartsOn: config.firstDayOfWeek.value })
  const weekDays = daysToShow
    ? Array.from({ length: daysToShow }, (_, index) =>
        addDays(startOfDay(fixedStartDate ?? date), index),
      )
    : eachDayOfInterval({ start: weekStart, end: weekEnd })
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const TIME_GUTTER_WIDTH = 84
  const gridTemplateColumns = `${TIME_GUTTER_WIDTH}px repeat(${weekDays.length}, minmax(0, 1fr))`
  const today = new Date()
  const t = translations[config.language.code as keyof typeof translations]

  const [currentTime, setCurrentTime] = useState(new Date())
  const hasScrolledRef = useRef(false)
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
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const ignoreNextEventClickRef = useRef(false)
  const isDraggingRef = useRef(false)

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
    if (!hasScrolledRef.current && scrollContainerRef.current) {
      const now = new Date()
      const currentHour = now.getHours()

      const hourElements =
        scrollContainerRef.current.querySelectorAll('.h-\\[60px\\]')
      if (hourElements.length > 0 && currentHour < hourElements.length) {
        const currentHourElement = hourElements[currentHour + 1]

        if (currentHourElement) {
          scrollContainerRef.current.scrollTo({
            top: (currentHourElement as HTMLElement).offsetTop - 100,
            behavior: 'auto',
          })

          hasScrolledRef.current = true
        }
      }
    }
  }, [date, weekDays])

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
        const containerRect = scrollContainerRef.current.getBoundingClientRect()
        const gridItems =
          scrollContainerRef.current.querySelectorAll('.grid-col')

        let closestDayIndex = 0
        let minDistance = Infinity

        gridItems.forEach((item, index) => {
          const rect = item.getBoundingClientRect()
          const centerX = rect.left + rect.width / 2
          const distance = Math.abs(e.clientX - centerX)

          if (distance < minDistance) {
            minDistance = distance
            closestDayIndex = index
          }
        })

        const relativeY =
          e.clientY - containerRect.top + scrollContainerRef.current.scrollTop
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
        const newStartDate = new Date(dragPreview.day)
        newStartDate.setHours(dragPreview.hour, dragPreview.minute, 0, 0)

        const newEndDate = add(newStartDate, { minutes: dragEventDuration })

        onEventDrop(draggingEvent, newStartDate, newEndDate)
      }

      // The browser fires `click` AFTER `mouseup`, so clearing the drag flag
      // here would let the event block's onClick open the preview at the drop
      // target. Suppress that one click instead (same mechanism the resize
      // handles and the context menu use).
      if (isDraggingRef.current) queueIgnoreEventClick()
      isDraggingRef.current = false
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

        onTimeSlotClick(startDate, endDate)
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
  }, [createSelection, onTimeSlotClick, weekDays])

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

  const formatDateWithTimezone = (date: Date) => {
    return layoutEngine.formatDateWithTimezone(date)
  }

  const handleEventDragStart = (event: CalendarEvent, e: React.MouseEvent) => {
    if (event.viewOnly) {
      e.preventDefault()
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
        const eventStartMinutes = start.getHours() * 60 + start.getMinutes()
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
  } = useEventResize({ onEventDrop, getMinutesFromMousePosition })

  const handleGridMouseDown = (
    dayIndex: number,
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0 || draggingEvent) return

    const startMinute = getMinutesFromMousePosition(event.clientY)
    createStartRef.current = { dayIndex, minute: startMinute }
    isCreatingRef.current = true
    setCreateSelection({ dayIndex, startMinute, endMinute: startMinute })
  }

  const ALL_DAY_BAR_HEIGHT = 20
  const ALL_DAY_BAR_GAP = 2
  const ALL_DAY_BAR_INSET = 2

  const allDaySegments = layoutAllDaySegments(
    events.filter((event) => isBannerEvent(event)),
    weekDays,
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
    <div className="flex flex-col h-full">
      <div
        className="relative z-30 bg-app-shell border-b"
        style={{ paddingRight: scrollbarWidth + 'px' }}
      >
        {/* One grid holds both the weekday header and the all-day area, so
            the divide-x lines run through both and always match. */}
        <div className="relative">
          <div className="grid divide-x" style={{ gridTemplateColumns }}>
            <div className="relative text-sm text-muted-foreground">
              {allDayRowHeight > 0 && (
                <span
                  className="absolute right-3"
                  style={{ bottom: allDayRowHeight - 20 + 'px' }}
                >
                  {t.allDay}
                </span>
              )}
            </div>
            {weekDays.map((day) => (
              <div key={day.toString()}>
                <div className="p-2 text-center">
                  <div>{t.weekdays[day.getDay()]}</div>
                  <div
                    className={cn(
                      'mx-auto flex h-6 w-6 items-center justify-center text-sm',
                      isSameDay(day, today) &&
                        'rounded-md bg-cal-today text-cal-today-foreground',
                    )}
                  >
                    {format(day, 'd')}
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
                left: TIME_GUTTER_WIDTH + 'px',
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
        <div className="text-sm text-muted-foreground">
          {hours.map((hour) => (
            <div key={hour} className="h-[60px] relative border-gray-200">
              <span
                className={cn(
                  'absolute right-3',
                  hour === 0 ? 'top-0' : 'top-0 -translate-y-1/2',
                )}
              >
                {formatTime(hour)}
              </span>
            </div>
          ))}
        </div>

        {weekDays.map((day, dayIndex) => {
          const dayEvents = events.filter((event) =>
            layoutEngine.shouldShowEventOnDay(event, day),
          )

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
              {hours.map((hour) => (
                <div key={hour} className="h-[60px] border-t" />
              ))}

              {eventLayouts.map(
                ({ event, start, end, column, totalColumns }) => {
                  const startMinutes =
                    start.getHours() * 60 + start.getMinutes()
                  const endMinutes = end.getHours() * 60 + end.getMinutes()
                  const isResizing = resize?.event.id === event.id
                  const displayStart = isResizing
                    ? resize.liveStart
                    : startMinutes
                  const displayEnd = isResizing ? resize.liveEnd : endMinutes
                  const renderStart = Math.min(displayStart, displayEnd)
                  const renderEnd = Math.max(displayStart, displayEnd)
                  const duration = renderEnd - renderStart
                  const displayStartDate = new Date(start)
                  displayStartDate.setHours(0, renderStart, 0, 0)
                  const displayEndDate = new Date(start)
                  displayEndDate.setHours(0, renderEnd, 0, 0)

                  const minHeight = 20
                  const height = Math.max(duration, minHeight)

                  const width = `calc((100% - 4px) / ${totalColumns})`
                  const left = `calc(${column} * ${width})`

                  const isMultiDayEvent = !isSameDay(
                    new Date(event.startDate),
                    new Date(event.endDate),
                  )
                  const canResize =
                    !event.viewOnly && !isMultiDayEvent && !isResizing

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
                            {formatDateWithTimezone(displayStartDate)} -{' '}
                            {formatDateWithTimezone(displayEndDate)}
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
                  className="absolute left-0 right-0 rounded-md bg-muted/40 border border-muted-foreground/20 pointer-events-none"
                  style={{
                    top: `${Math.min(createSelection.startMinute, createSelection.endMinute)}px`,
                    height: `${Math.max(Math.abs(createSelection.endMinute - createSelection.startMinute), 15)}px`,
                    zIndex: 5,
                  }}
                >
                  <div className="px-2 pt-1 text-xs font-medium text-muted-foreground">
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
              {selection &&
                !createSelection &&
                (() => {
                  const slice = clampRangeToDay(selection, day)
                  if (!slice) return null
                  const { startMinute, endMinute } = slice
                  // Anchor the editor to the first *visible* slice — when the
                  // range starts before this period, its true start day is
                  // not on screen.
                  const firstVisibleIndex = weekDays.findIndex(
                    (d) => clampRangeToDay(selection, d) !== null,
                  )
                  const isFirstDay = dayIndex === firstVisibleIndex
                  return (
                    <div
                      {...(isFirstDay ? { 'data-create-selection': true } : {})}
                      className="absolute left-0 right-0 rounded-md bg-muted/40 border border-muted-foreground/20 pointer-events-none"
                      style={{
                        top: `${startMinute}px`,
                        height: `${Math.max(endMinute - startMinute, 15)}px`,
                        zIndex: 5,
                      }}
                    >
                      <div className="px-2 pt-1 text-xs font-medium text-muted-foreground">
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
                  const currentTimeInTimezone = new Date(
                    currentTime.toLocaleString('en-US', {
                      timeZone: config.timezone,
                    }),
                  )
                  const currentHours = currentTimeInTimezone.getHours()
                  const currentMinutes = currentTimeInTimezone.getMinutes()

                  const topPosition = currentHours * 60 + currentMinutes

                  return (
                    <div
                      className="absolute left-0 right-0 border-t-2 border-cal-now z-30 pointer-events-none"
                      style={{
                        top: `${topPosition}px`,
                      }}
                    >
                      <span className="absolute -left-[6px] -top-[7px] h-3 w-3 rounded-full bg-cal-now" />
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
