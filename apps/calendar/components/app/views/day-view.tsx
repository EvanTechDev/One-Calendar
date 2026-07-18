'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { Edit3, Share2, Bookmark, Trash2 } from 'lucide-react'
import { format, isSameDay, isWithinInterval, add } from 'date-fns'
import { cn } from '@zntr/utils'
import type { CalendarEvent } from '../calendar'
import { translations } from '@zntr/i18n/calendar'
import { formatSelectionRange } from '@/components/app/views/selection-range'
import {
  getEventAccentColor,
  getEventBackgroundColor,
} from '@/components/app/views/event-colors'
import { EventLayoutEngine as EventLayoutEngineClass } from '@/components/app/views/engine/EventLayoutEngine'
import type { ViewConfig } from '@/components/app/calendar-types'

const ContextMenu = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
)
const ContextMenuTrigger = ({
  children,
}: {
  children: React.ReactNode
  asChild?: boolean
}) => <>{children}</>
const ContextMenuContent = ({
  children,
  _className,
}: {
  children: React.ReactNode
  className?: string
  _className?: string
}) => <>{children}</>
const ContextMenuItem = (_props: {
  children?: React.ReactNode
  className?: string
  onSelect?: (event: React.SyntheticEvent) => void
}) => null

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
  onBackToCalendar,
}: DayViewProps) {
  const layoutEngine = useMemo(
    () => EventLayoutEngineClass.create(config),
    [config],
  )

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

  const menuLabels = {
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

  const renderAllDayEvents = (allDayEvents: CalendarEvent[]) => {
    const eventSpacing = 3

    return allDayEvents.map((event, index) => (
      <ContextMenu key={`allday-${event.id}`}>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              'relative rounded-lg p-1 text-xs cursor-pointer overflow-hidden',
              event.color,
            )}
            style={{
              height: '20px',
              top: index * (20 + eventSpacing) + 'px',
              position: 'absolute',
              left: '0',
              right: '0',
              opacity: isDark ? 1 : 0.9,
              backgroundColor: getEventBackgroundColor(event.color, isDark),
              zIndex: 10 + index,
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
                onEventClick(event, e.currentTarget as HTMLElement)
              }
            }}
          >
            <div
              className={cn('absolute left-0 top-0 w-1 h-full rounded-l-md')}
              style={{ backgroundColor: getEventAccentColor(event.color) }}
            />
            <div
              className="pl-1.5 truncate"
              style={{ color: getEventAccentColor(event.color) }}
            >
              {event.title}
            </div>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-40">
          <ContextMenuItem
            onSelect={(e) => {
              e.preventDefault()
              e.stopPropagation()
              queueIgnoreEventClick()
              onEditEvent?.(event)
            }}
          >
            <Edit3 className="mr-2 h-4 w-4" />
            {menuLabels.edit}
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={(e) => {
              e.preventDefault()
              e.stopPropagation()
              queueIgnoreEventClick()
              onShareEvent?.(event)
            }}
          >
            <Share2 className="mr-2 h-4 w-4" />
            {menuLabels.share}
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={(e) => {
              e.preventDefault()
              e.stopPropagation()
              queueIgnoreEventClick()
              onBookmarkEvent?.(event)
            }}
          >
            <Bookmark className="mr-2 h-4 w-4" />
            {menuLabels.bookmark}
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={(e) => {
              e.preventDefault()
              e.stopPropagation()
              queueIgnoreEventClick()
              onDeleteEvent?.(event)
            }}
            className="text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {menuLabels.delete}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    ))
  }

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

  const dayEvents = events.filter((event) => {
    const start = new Date(event.startDate)
    const end = new Date(event.endDate)

    if (!layoutEngine.isAllDayEvent(event)) {
      if (isSameDay(start, date)) return true

      if (layoutEngine.isMultiDayEvent(start, end)) {
        return isWithinInterval(date, { start, end })
      }

      return false
    }

    if (layoutEngine.isMultiDayEvent(start, end)) {
      return isSameDay(start, date)
    }

    return isSameDay(start, date)
  })

  const { allDayEvents, regularEvents } = layoutEngine.separateEvents(
    dayEvents,
    date,
  )

  const eventSpacing = 2
  const allDayEventsHeight =
    allDayEvents.length > 0
      ? allDayEvents.length * 20 + (allDayEvents.length - 1) * eventSpacing
      : 0

  const eventLayouts = layoutEngine.layoutEventsForDay(regularEvents, date)

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
            {renderAllDayEvents(allDayEvents)}
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

          {eventLayouts.map(({ event, column, totalColumns }) => {
            const start = new Date(event.startDate)
            const end = new Date(event.endDate)

            const startMinutes = start.getHours() * 60 + start.getMinutes()
            const endMinutes = end.getHours() * 60 + end.getMinutes()
            const duration = endMinutes - startMinutes

            const maxEndMinutes = 24 * 60
            const displayDuration = Math.min(
              duration,
              maxEndMinutes - startMinutes,
            )

            const minHeight = 20
            const height = Math.max(displayDuration, minHeight)

            const width = `calc((100% - 8px) / ${totalColumns})`
            const left = `calc(${column} * ${width})`

            return (
              <ContextMenu key={event.id}>
                <ContextMenuTrigger asChild>
                  <div
                    className={cn(
                      'relative absolute rounded-lg p-2 text-sm cursor-pointer overflow-hidden',
                      event.color,
                    )}
                    style={{
                      top: `${startMinutes}px`,
                      height: `${height}px`,
                      opacity: isDark ? 1 : 0.9,
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
                      if (!isDraggingRef.current) {
                        onEventClick(event, e.currentTarget as HTMLElement)
                      }
                    }}
                  >
                    <div
                      className={cn(
                        'absolute left-0 top-0 w-1 h-full rounded-l-md',
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
                          style={{ color: getEventAccentColor(event.color) }}
                        >
                          {layoutEngine.formatDateWithTimezone(start)} -{' '}
                          {layoutEngine.formatDateWithTimezone(end)}
                        </div>
                      )}
                    </div>
                  </div>
                </ContextMenuTrigger>

                <ContextMenuContent className="w-40">
                  <ContextMenuItem
                    onSelect={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      queueIgnoreEventClick()
                      onEditEvent?.(event)
                    }}
                  >
                    <Edit3 className="mr-2 h-4 w-4" />
                    {menuLabels.edit}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onSelect={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      queueIgnoreEventClick()
                      onShareEvent?.(event)
                    }}
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    {menuLabels.share}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onSelect={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      queueIgnoreEventClick()
                      onBookmarkEvent?.(event)
                    }}
                  >
                    <Bookmark className="mr-2 h-4 w-4" />
                    {menuLabels.bookmark}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onSelect={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      queueIgnoreEventClick()
                      onDeleteEvent?.(event)
                    }}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {menuLabels.delete}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            )
          })}

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
                  layoutEngine.formatHourMinute,
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
