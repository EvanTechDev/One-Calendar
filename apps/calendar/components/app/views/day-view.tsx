'use client'

import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { format, isSameDay, add } from 'date-fns'
import { cn } from '@zntr/utils'
import type { CalendarEvent } from '../calendar'
import { translations } from '@zntr/i18n/calendar'
import {
  formatSelectionRange,
  clampRangeToDay,
} from '@/components/app/views/selection-range'
import type { ViewConfig } from '@/lib/calendar-types'
import {
  getEventAccentColor,
  getEventBackgroundColor,
} from '@/lib/event-colors'
import {
  EventRenderer,
  AllDayEventRenderer,
} from '@/components/app/views/event-renderer'
import { useEventFilter } from '@/hooks/use-event-filter'
import { useEventResize } from '@/hooks/use-event-resize'

interface DayViewProps {
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
  onEditEvent?: (event: CalendarEvent) => void
  onDeleteEvent?: (event: CalendarEvent) => void
  onBookmarkEvent?: (event: CalendarEvent) => void
  onEventDrop?: (
    event: CalendarEvent,
    newStartDate: Date,
    newEndDate: Date,
  ) => void
  onBackToCalendar?: () => void
  /**
   * Range the event editor is being opened for. Rendered as the same blue box
   * as a live drag — it is the editor popover's anchor (CORE-191) — and
   * disappears when the editor closes and the range is cleared.
   */
  selection?: { start: Date; end: Date } | null
}

export default function DayView({
  date,
  events,
  onEventClick,
  onTimeSlotClick,
  config,
  onEditEvent,
  onDeleteEvent,
  onBookmarkEvent,
  onEventDrop,
  onBackToCalendar: _onBackToCalendar,
  selection = null,
}: DayViewProps) {
  const {
    allDayEventsForDate,
    regularEventsForDate,
    layoutEventsForDate,
    layoutEngine,
  } = useEventFilter({ events, config, date })

  const hours = Array.from({ length: 24 }, (_, i) => i)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const hasScrolledRef = useRef(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const t = translations[config.language.code as keyof typeof translations]

  const [draggingEvent, setDraggingEvent] = useState<CalendarEvent | null>(null)
  const [dragStartPosition, setDragStartPosition] = useState<{
    x: number
    y: number
  } | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(
    null,
  )
  const [dragPreview, setDragPreview] = useState<{
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
    startMinute: number
    endMinute: number
  } | null>(null)
  const createStartMinuteRef = useRef<number | null>(null)
  const isCreatingRef = useRef(false)
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')

  const _menuLabels = {
    edit: t.edit,
    share: t.share,
    bookmark: t.bookmark,
    delete: t.delete,
  }

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
  }, [date])

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

        const relativeY =
          e.clientY - containerRect.top + scrollContainerRef.current.scrollTop
        const positionMinutes = snapToQuarterHour(relativeY)
        const startMinutes = snapToQuarterHour(
          positionMinutes - dragOffsetMinutesRef.current,
        )

        setDragPreview({
          hour: Math.floor(startMinutes / 60),
          minute: startMinutes % 60,
        })
      }
    }

    const handleMouseUp = () => {
      if (
        draggingEvent &&
        isDraggingRef.current &&
        dragPreview &&
        onEventDrop
      ) {
        const newStartDate = new Date(date)
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
    date,
    dragEventDuration,
  ])

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isCreatingRef.current || createStartMinuteRef.current === null)
        return
      const endMinute = getMinutesFromMousePosition(event.clientY)
      setCreateSelection({
        startMinute: createStartMinuteRef.current,
        endMinute,
      })
    }

    const handleMouseUp = () => {
      if (!isCreatingRef.current || createStartMinuteRef.current === null)
        return

      const startMinute = Math.min(
        createStartMinuteRef.current,
        createSelection?.endMinute ?? createStartMinuteRef.current,
      )
      const endMinute = Math.max(
        createStartMinuteRef.current,
        createSelection?.endMinute ?? createStartMinuteRef.current,
      )

      const startDate = new Date(date)
      startDate.setHours(0, startMinute, 0, 0)

      const effectiveEndMinute =
        endMinute === startMinute ? startMinute + 30 : endMinute
      const endDate = new Date(date)
      endDate.setHours(0, Math.min(effectiveEndMinute, 24 * 60), 0, 0)

      onTimeSlotClick(startDate, endDate)

      isCreatingRef.current = false
      createStartMinuteRef.current = null
      setCreateSelection(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [createSelection, date, onTimeSlotClick])

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

  const handleGridMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || draggingEvent) return

    const startMinute = getMinutesFromMousePosition(event.clientY)
    createStartMinuteRef.current = startMinute
    isCreatingRef.current = true
    setCreateSelection({ startMinute, endMinute: startMinute })
  }

  const allDayEvents = allDayEventsForDate(date)
  const _regularEvents = regularEventsForDate(date)
  const eventLayouts = layoutEventsForDate(date)

  const eventSpacing = 3
  const allDayEventsHeight =
    allDayEvents.length > 0
      ? allDayEvents.length * 20 + (allDayEvents.length - 1) * eventSpacing
      : 0

  const renderDragPreview = () => {
    if (!dragPreview || !draggingEvent) return null

    const startMinutes = dragPreview.hour * 60 + dragPreview.minute
    const endMinutes = startMinutes + dragEventDuration

    return (
      <div
        className={cn(
          'absolute rounded-md p-2 text-sm overflow-hidden',
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
              {layoutEngine.formatHourMinute(
                dragPreview.hour,
                dragPreview.minute,
              )}{' '}
              -{' '}
              {layoutEngine.formatHourMinute(
                Math.floor(endMinutes / 60),
                endMinutes % 60,
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-[84px_1fr] border-b relative z-30 bg-app-shell">
        <div className="p-2 text-center">
          <div className="text-sm text-muted-foreground">
            {t.weekdays[date.getDay()]}
          </div>
          <div
            className={cn(
              'mx-auto flex h-6 w-6 items-center justify-center text-sm',
              isSameDay(date, new Date()) &&
                'rounded-md bg-cal-today text-cal-today-foreground',
            )}
          >
            {format(date, 'd')}
          </div>
        </div>
        <div className="p-2">
          {}
          <div
            className="relative"
            style={{ height: allDayEventsHeight + 'px' }}
          >
            {allDayEvents.map((event, index) => (
              <AllDayEventRenderer
                key={`allday-${event.id}`}
                event={event}
                index={index}
                config={config}
                isDark={isDark}
                onEventClick={onEventClick}
                onEditEvent={onEditEvent}
                onDeleteEvent={onDeleteEvent}
                onBookmarkEvent={onBookmarkEvent}
                onEventDragStart={handleEventDragStart}
                onEventDragEnd={handleEventDragEnd}
                isDragging={isDraggingRef.current}
                ignoreNextEventClickRef={ignoreNextEventClickRef}
                isDraggingRef={isDraggingRef}
                queueIgnoreEventClick={queueIgnoreEventClick}
                eventSpacing={eventSpacing}
              />
            ))}
          </div>
        </div>
      </div>

      <div
        className="flex-1 grid grid-cols-[84px_1fr] overflow-auto select-none"
        ref={scrollContainerRef}
      >
        <div className="text-sm text-muted-foreground">
          {hours.map((hour) => (
            <div key={hour} className="h-[60px] relative">
              <span
                className={cn(
                  'absolute right-3',
                  hour === 0 ? 'top-0' : 'top-0 -translate-y-1/2',
                )}
              >
                {layoutEngine.formatTimeForDisplay(hour, 0)}
              </span>
            </div>
          ))}
        </div>

        <div
          className="relative border-l select-none"
          onMouseDown={handleGridMouseDown}
        >
          {hours.map((hour) => (
            <div key={hour} className="h-[60px] border-t" />
          ))}

          {eventLayouts.map(
            ({ event, start, end, column, totalColumns, isMultiDay }) => (
              <EventRenderer
                key={event.id}
                event={event}
                layout={{ start, end, column, totalColumns, isMultiDay }}
                config={config}
                isDark={isDark}
                onEventClick={onEventClick}
                onEditEvent={onEditEvent}
                onDeleteEvent={onDeleteEvent}
                onBookmarkEvent={onBookmarkEvent}
                onEventDragStart={handleEventDragStart}
                onEventDragEnd={handleEventDragEnd}
                onEventResizeStart={beginResize}
                resizeOverride={
                  resize?.event.id === event.id
                    ? {
                        startMinutes: resize.liveStart,
                        endMinutes: resize.liveEnd,
                      }
                    : null
                }
                suppressResizeClickRef={suppressResizeClickRef}
                isDragging={isDraggingRef.current}
                ignoreNextEventClickRef={ignoreNextEventClickRef}
                isDraggingRef={isDraggingRef}
                queueIgnoreEventClick={queueIgnoreEventClick}
              />
            ),
          )}

          {createSelection && (
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
                  (hour, min) => layoutEngine.formatHourMinute(hour, min),
                )}
              </div>
            </div>
          )}

          {/* The editor's anchor: the committed/draft range, kept visible
              while the editor popover is open (CORE-191) and following the
              editor's date-time fields. A range wider than this day renders
              clamped to the day; a range that misses it renders nothing. */}
          {selection &&
            !createSelection &&
            (() => {
              const slice = clampRangeToDay(selection, date)
              if (!slice) return null
              const { startMinute, endMinute } = slice
              return (
                <div
                  data-create-selection
                  className="absolute left-0 right-0 rounded-md bg-muted/40 border border-muted-foreground/20 pointer-events-none"
                  style={{
                    top: `${startMinute}px`,
                    height: `${Math.max(endMinute - startMinute, 15)}px`,
                    zIndex: 5,
                  }}
                >
                  <div className="px-2 pt-1 text-xs font-medium text-muted-foreground">
                    {formatSelectionRange(startMinute, endMinute, (hour, min) =>
                      layoutEngine.formatHourMinute(hour, min),
                    )}
                  </div>
                </div>
              )
            })()}

          {}
          {dragPreview && renderDragPreview()}

          {(() => {
            const today = new Date()
            const isToday = isSameDay(date, today)

            if (!isToday) return null

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
      </div>

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
