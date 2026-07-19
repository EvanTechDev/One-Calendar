'use client'

import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { format, isSameDay, add } from 'date-fns'
import { cn } from '@zntr/utils'
import type { CalendarEvent } from '../calendar'
import { translations } from '@zntr/i18n/calendar'
import { formatSelectionRange } from '@/components/app/views/selection-range'
import type { ViewConfig } from '@/components/app/calendar-types'
import {
  getEventAccentColor,
  getEventBackgroundColor,
} from '@/components/app/views/event-colors'
import { EventRenderer } from '@/components/app/views/EventRenderer'
import { useEventFilter } from '@/components/app/hooks/useEventFilter'

interface DayViewProps {
  date: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent, anchorEl?: HTMLElement | null) => void
  onTimeSlotClick: (startDate: Date, endDate?: Date) => void
  config: ViewConfig
  onEditEvent?: (event: CalendarEvent) => void
  onDeleteEvent?: (event: CalendarEvent) => void
  onShareEvent?: (event: CalendarEvent) => void
  onBookmarkEvent?: (event: CalendarEvent) => void
  onEventDrop?: (
    event: CalendarEvent,
    newStartDate: Date,
    newEndDate: Date,
  ) => void
  onBackToCalendar?: () => void
}

export default function DayView({
  date,
  events,
  onEventClick,
  onTimeSlotClick,
  config,
  onEditEvent,
  onDeleteEvent,
  onShareEvent,
  onBookmarkEvent,
  onEventDrop,
  onBackToCalendar: _onBackToCalendar,
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
        const hour = Math.floor(relativeY / 60)
        const minute = Math.floor((relativeY % 60) / 15) * 15

        setDragPreview({
          hour: hour,
          minute: minute,
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
    e.preventDefault()
    e.stopPropagation()

    longPressTimeoutRef.current = setTimeout(() => {
      const start = new Date(event.startDate)
      const end = new Date(event.endDate)

      const durationMs = end.getTime() - start.getTime()
      const durationMinutes = Math.round(durationMs / (1000 * 60))

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
          'absolute rounded-lg p-2 text-sm overflow-hidden',
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
          className={cn('absolute left-0 top-0 w-1 h-full rounded-l-md')}
          style={{ backgroundColor: getEventAccentColor(draggingEvent.color) }}
        />
        <div className="pl-1">
          <div
            className="font-medium truncate"
            style={{ color: getEventAccentColor(draggingEvent.color) }}
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
      <div className="grid grid-cols-[100px_1fr] border-b relative z-30 bg-background">
        <div className="py-2 text-center">
          <div className="text-sm text-muted-foreground">
            {t.weekdays[date.getDay()]}
          </div>
          <div
            className={cn(
              'text-3xl font-semibold text-foreground',
              isSameDay(date, new Date()) && 'text-[#0066ff]',
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
            {allDayEvents.map((event, _index) => (
              <EventRenderer
                key={`allday-${event.id}`}
                event={event}
                layout={{
                  start: new Date(event.startDate),
                  end: new Date(event.endDate),
                  column: 0,
                  totalColumns: 1,
                  isMultiDay: false,
                }}
                config={config}
                isDark={isDark}
                onEventClick={onEventClick}
                onEditEvent={onEditEvent}
                onDeleteEvent={onDeleteEvent}
                onShareEvent={onShareEvent}
                onBookmarkEvent={onBookmarkEvent}
                onEventDragStart={handleEventDragStart}
                onEventDragEnd={handleEventDragEnd}
                isDragging={isDraggingRef.current}
                ignoreNextEventClickRef={ignoreNextEventClickRef}
                isDraggingRef={isDraggingRef}
                queueIgnoreEventClick={queueIgnoreEventClick}
                showTime={false}
              />
            ))}
          </div>
        </div>
      </div>

      <div
        className="flex-1 grid grid-cols-[100px_1fr] overflow-auto select-none"
        ref={scrollContainerRef}
      >
        <div className="text-sm text-muted-foreground">
          {hours.map((hour) => (
            <div key={hour} className="h-[60px] relative">
              <span
                className={cn(
                  'absolute right-4',
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

          {eventLayouts.map(({ event, start, end, column, totalColumns }) => (
            <EventRenderer
              key={event.id}
              event={event}
              layout={{ start, end, column, totalColumns, isMultiDay: false }}
              config={config}
              isDark={isDark}
              onEventClick={onEventClick}
              onEditEvent={onEditEvent}
              onDeleteEvent={onDeleteEvent}
              onShareEvent={onShareEvent}
              onBookmarkEvent={onBookmarkEvent}
              onEventDragStart={handleEventDragStart}
              onEventDragEnd={handleEventDragEnd}
              isDragging={isDraggingRef.current}
              ignoreNextEventClickRef={ignoreNextEventClickRef}
              isDraggingRef={isDraggingRef}
              queueIgnoreEventClick={queueIgnoreEventClick}
            />
          ))}

          {createSelection && (
            <div
              className="absolute left-0 right-0 rounded-lg bg-[#0066FF]/15 border border-[#0066FF]/40 pointer-events-none"
              style={{
                top: `${Math.min(createSelection.startMinute, createSelection.endMinute)}px`,
                height: `${Math.max(Math.abs(createSelection.endMinute - createSelection.startMinute), 15)}px`,
                zIndex: 5,
              }}
            >
              <div className="px-2 pt-1 text-xs font-medium text-[#0066FF]">
                {formatSelectionRange(
                  createSelection.startMinute,
                  createSelection.endMinute,
                  (hour, min) => layoutEngine.formatHourMinute(hour, min),
                )}
              </div>
            </div>
          )}

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
                className="absolute left-0 right-0 border-t-2 border-[#0066FF] z-30 pointer-events-none"
                style={{
                  top: `${topPosition}px`,
                }}
              >
                <span className="absolute -left-1.5 -top-[5px] h-2.5 w-2.5 rounded-full bg-[#0066FF]" />
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
