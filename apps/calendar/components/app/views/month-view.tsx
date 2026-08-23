'use client'

import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  subDays,
} from 'date-fns'
import { translations } from '@zntr/i18n/calendar'
import type { CalendarEvent } from '../calendar'
import { cn } from '@zntr/utils'
import {
  EVENT_BG_TO_ACCENT,
  EVENT_BG_TO_DARK,
  DEFAULT_ACCENT,
} from '@/lib/event-colors'
import type { ViewConfig } from '@/lib/calendar-types'
import { useCallback, useRef, useState } from 'react'
import { Popover, PopoverAnchor, PopoverContent } from '@zntr/ui/popover'
import { RemoveScroll } from 'react-remove-scroll'

interface RemainingPopoverState {
  key: string
  anchorRect: DOMRect
  remainingEvents: CalendarEvent[]
}

interface MonthViewProps {
  date: Date
  events: CalendarEvent[]
  /**
   * Day being created into. The cell is marked [data-create-selection] and
   * highlighted so the editor popover has something to anchor to — the
   * month grid has no time axis, so the whole day cell plays the role the
   * blue range box plays in day/week views (CORE-191).
   */
  selection?: { start: Date; end: Date } | null
  onEventClick: (
    event: CalendarEvent,
    anchorEl?: HTMLElement | null,
    clientX?: number,
    clientY?: number,
  ) => void
  config: ViewConfig
}

export default function MonthView({
  date,
  events,
  onEventClick,
  config,
  selection = null,
}: MonthViewProps) {
  const language = config.language
  const firstDayOfWeek = config.firstDayOfWeek
  const t = translations[language.code as keyof typeof translations]
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const today = new Date()
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')

  const startWeekDay = monthStart.getDay()
  const leadingEmptyDays = (7 + (startWeekDay - firstDayOfWeek.value)) % 7

  const prevMonthDays: Date[] = []
  for (let i = leadingEmptyDays; i > 0; i--) {
    prevMonthDays.push(subDays(monthStart, i))
  }

  const totalDays = [...prevMonthDays, ...monthDays]

  const [remainingPopover, setRemainingPopover] =
    useState<RemainingPopoverState | null>(null)

  const handleRemainingClick = useCallback(
    (
      e: React.MouseEvent<HTMLButtonElement>,
      day: Date,
      allDayEvents: CalendarEvent[],
    ) => {
      const cell = (e.currentTarget as HTMLElement).parentElement?.parentElement
      const rect = cell
        ? cell.getBoundingClientRect()
        : e.currentTarget.getBoundingClientRect()
      const key = format(day, 'yyyy-MM-dd')
      setRemainingPopover({
        key,
        anchorRect: rect,
        remainingEvents: allDayEvents.slice(3),
      })
    },
    [],
  )

  const closeRemainingPopover = useCallback(() => setRemainingPopover(null), [])

  const remainingPopoverListRef = useRef<HTMLDivElement>(null)

  return (
    <RemoveScroll
      enabled={!!remainingPopover}
      shards={[remainingPopoverListRef]}
    >
      <div className="grid grid-cols-7 gap-1 p-4">
        {(() => {
          const orderedDays = [
            ...t.weekdays.slice(firstDayOfWeek.value),
            ...t.weekdays.slice(0, firstDayOfWeek.value),
          ]
          return orderedDays.map((day) => (
            <div key={day} className="text-center font-medium text-sm py-2">
              {day}
            </div>
          ))
        })()}

        {totalDays.map((day) => {
          const dayEvents = events.filter((event) =>
            isSameDay(new Date(event.startDate), day),
          )
          const visibleEvents = dayEvents.slice(0, 3)
          const remainingCount = dayEvents.length - visibleEvents.length

          const isCreateTarget = selection && isSameDay(selection.start, day)

          return (
            <div
              key={day.toString()}
              {...(isCreateTarget ? { 'data-create-selection': true } : {})}
              className={cn(
                'min-h-[100px] p-2 border rounded-xl',
                isCreateTarget &&
                  'border-cal-accent/60 bg-cal-accent/5 ring-1 ring-cal-accent/40',
              )}
            >
              <div
                className={cn(
                  'font-medium text-sm',
                  isSameMonth(day, date) ? '' : 'text-gray-400',
                  isSameMonth(day, date) && isSameDay(day, today)
                    ? 'text-cal-accent font-bold'
                    : '',
                )}
              >
                {format(day, 'd')}
              </div>
              <div className="space-y-1">
                {visibleEvents.map((event) => (
                  <div
                    key={event.id}
                    data-event-id={event.id}
                    className={cn(
                      'relative text-xs truncate rounded-sm p-1 cursor-pointer text-white',
                      event.color,
                    )}
                    onClick={(e) =>
                      onEventClick(
                        event,
                        e.currentTarget as HTMLElement,
                        e.clientX,
                        e.clientY,
                      )
                    }
                    style={{
                      opacity: 1,
                      backgroundColor: isDark
                        ? EVENT_BG_TO_DARK[event.color]
                        : undefined,
                    }}
                  >
                    <div
                      className={cn(
                        'absolute left-0 top-0 w-1 h-full rounded-l-sm',
                      )}
                      style={{
                        backgroundColor:
                          EVENT_BG_TO_ACCENT[event.color] ?? DEFAULT_ACCENT,
                      }}
                    />
                    <div
                      className="pl-1.5 truncate"
                      style={{
                        color:
                          EVENT_BG_TO_ACCENT[event.color] ?? DEFAULT_ACCENT,
                      }}
                    >
                      {event.title}
                    </div>
                  </div>
                ))}
                {remainingCount > 0 && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={(e) => handleRemainingClick(e, day, dayEvents)}
                  >
                    {(remainingCount === 1
                      ? t.moreEvents
                      : t.moreEventsPlural
                    ).replace('{count}', remainingCount.toString())}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Popover
        open={!!remainingPopover}
        onOpenChange={(open) => {
          if (!open) closeRemainingPopover()
        }}
        modal={false}
      >
        <PopoverAnchor asChild>
          <div
            style={{
              position: 'fixed',
              left: remainingPopover ? remainingPopover.anchorRect.right : 0,
              top: remainingPopover
                ? remainingPopover.anchorRect.top +
                  remainingPopover.anchorRect.height / 2
                : 0,
              width: 0,
              height: 0,
              pointerEvents: 'none',
            }}
          />
        </PopoverAnchor>
        {remainingPopover && (
          <PopoverContent
            side="right"
            align="center"
            sideOffset={8}
            className="w-72 rounded-lg border bg-popover p-3 shadow-md outline-none"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">{t.events}</div>
              <button
                type="button"
                onClick={closeRemainingPopover}
                className="text-muted-foreground hover:text-foreground ml-2 text-xs"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {remainingPopover.remainingEvents.length > 0 ? (
              <div
                ref={remainingPopoverListRef}
                className="min-h-0 max-h-[260px] overflow-y-auto space-y-1.5"
              >
                {remainingPopover.remainingEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className="relative w-full cursor-pointer truncate rounded-sm p-1.5 pl-3 text-left text-xs"
                    style={{
                      backgroundColor: isDark
                        ? EVENT_BG_TO_DARK[event.color]
                        : undefined,
                    }}
                    onClick={(e) => {
                      onEventClick(event, e.currentTarget, e.clientX, e.clientY)
                    }}
                  >
                    <div
                      className="absolute left-0 top-0 h-full w-1 rounded-l-sm"
                      style={{
                        backgroundColor:
                          EVENT_BG_TO_ACCENT[event.color] ?? DEFAULT_ACCENT,
                      }}
                    />
                    <div
                      className="truncate"
                      style={{
                        color:
                          EVENT_BG_TO_ACCENT[event.color] ?? DEFAULT_ACCENT,
                      }}
                    >
                      {event.title}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                {t.noEventsFound}
              </div>
            )}
          </PopoverContent>
        )}
      </Popover>
    </RemoveScroll>
  )
}
