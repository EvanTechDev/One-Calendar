'use client'

import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfWeek,
} from 'date-fns'
import { translations } from '@zntr/i18n/calendar'
import type { CalendarEvent } from '../calendar'
import { useCallback, useMemo, useRef, useState } from 'react'
import { cn } from '@zntr/utils'
import type { ViewConfig } from '@/lib/calendar-types'
import { selectionCoversDay } from '@/components/app/views/selection-range'
import { useEventsByDay } from '@/hooks/use-events-by-day'
import { Popover, PopoverAnchor, PopoverContent } from '@zntr/ui/popover'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@zntr/ui/sheet'
import { RemoveScroll } from 'react-remove-scroll'
import { isMobileViewport } from '@/lib/mobile-viewport'
import { isChildOverlayInteraction } from '@/lib/popover-nesting'
import {
  DEFAULT_ACCENT,
  EVENT_BG_TO_ACCENT,
  EVENT_BG_TO_DARK,
} from '@/lib/event-colors'

interface YearViewProps {
  date: Date
  events: CalendarEvent[]
  /**
   * Day being created into. The day button is marked
   * [data-create-selection] and highlighted so the editor popover anchors
   * to it (CORE-191) — the year grid's day dot plays the role of the blue
   * range box.
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

function getAccent(color: string) {
  return EVENT_BG_TO_ACCENT[color] || DEFAULT_ACCENT
}

function getDarkBg(color: string) {
  return EVENT_BG_TO_DARK[color]
}

interface PopoverState {
  key: string
  anchorRect: DOMRect
  day: Date
  dayEvents: CalendarEvent[]
}

export default function YearView({
  date,
  events,
  onEventClick,
  onDayHeaderClick,
  config,
  selection = null,
}: YearViewProps) {
  const t = translations[config.language.code as keyof typeof translations]
  const currentYear = date.getFullYear()
  const today = useMemo(() => new Date(), [])
  const containerRef = useRef<HTMLDivElement>(null)
  const [popover, setPopover] = useState<PopoverState | null>(null)

  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')

  const weekdayLabels = useMemo(
    () => [
      ...t.weekdays.slice(config.firstDayOfWeek.value),
      ...t.weekdays.slice(0, config.firstDayOfWeek.value),
    ],
    [config.firstDayOfWeek.value, t.weekdays],
  )

  const eventsByDayKey = useEventsByDay(events)

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, monthIndex) => {
        const monthStart = new Date(currentYear, monthIndex, 1)
        const monthEnd = endOfMonth(monthStart)
        const gridStart = startOfWeek(monthStart, {
          weekStartsOn: config.firstDayOfWeek.value,
        })
        const monthDays = eachDayOfInterval({
          start: gridStart,
          end: monthEnd,
        })

        while (monthDays.length < 42) {
          const lastDay = monthDays[monthDays.length - 1]
          monthDays.push(
            new Date(
              lastDay.getFullYear(),
              lastDay.getMonth(),
              lastDay.getDate() + 1,
            ),
          )
        }

        return {
          monthIndex,
          label: t.months[monthIndex] ?? format(monthStart, 'LLLL'),
          days: monthDays,
        }
      }),
    [currentYear, config.firstDayOfWeek.value, t.months],
  )

  // Mobile Form (ADR-0019): a tapped day's events open in a bottom sheet,
  // like the month view — the anchored popover is a desktop surface.
  const [daySheet, setDaySheet] = useState<{
    day: Date
    dayEvents: CalendarEvent[]
  } | null>(null)

  const handleDayClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, day: Date, dayKey: string) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const dayEvents = eventsByDayKey.get(dayKey) ?? []
      if (isMobileViewport()) {
        setDaySheet({ day, dayEvents })
        return
      }
      const key = `${day.getMonth()}-${dayKey}`
      setPopover({ key, anchorRect: rect, day, dayEvents })
    },
    [eventsByDayKey],
  )

  const closePopover = useCallback(() => setPopover(null), [])

  const popoverListRef = useRef<HTMLDivElement>(null)

  return (
    <RemoveScroll enabled={!!popover} shards={[popoverListRef]}>
      <div className="p-3 md:p-4" ref={containerRef}>
        {/* Mobile Form (ADR-0019): two columns of compact month grids below
            768px. The desktop auto-fit layout is untouched from md up. */}
        <div className="grid gap-y-4 max-md:grid-cols-2 max-md:gap-x-3 md:[grid-template-columns:repeat(auto-fit,minmax(15.5rem,15.5rem))] md:justify-between md:gap-x-6">
          {months.map((month) => (
            <section key={month.label} className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">
                {month.label}
              </h2>
              <div className="grid grid-cols-7 gap-y-1 text-center">
                {weekdayLabels.map((weekday) => (
                  <div
                    key={`${month.label}-${weekday}`}
                    className="text-xs text-muted-foreground"
                  >
                    {weekday}
                  </div>
                ))}

                {month.days.map((day) => {
                  const dayKey = format(day, 'yyyy-MM-dd')
                  const isToday = isSameDay(day, today)
                  const isCurrentMonth = isSameMonth(
                    day,
                    new Date(currentYear, month.monthIndex, 1),
                  )
                  const dayEvents = eventsByDayKey.get(dayKey)

                  const isCreateTarget =
                    selection &&
                    isCurrentMonth &&
                    selectionCoversDay(selection, day)
                  // Anchor on the range's start day, or on Jan 1 when the
                  // range began in an earlier year.
                  const isCreateAnchor =
                    isCreateTarget &&
                    (isSameDay(selection.start, day) ||
                      (selection.start < new Date(currentYear, 0, 1) &&
                        day.getMonth() === 0 &&
                        day.getDate() === 1))

                  return (
                    <button
                      key={`${month.label}-${dayKey}`}
                      type="button"
                      {...(isCreateAnchor
                        ? { 'data-create-selection': true }
                        : {})}
                      className={cn(
                        'mx-auto flex h-6 w-6 items-center justify-center rounded-full text-xs transition-colors hover:bg-accent',
                        !isCurrentMonth && 'text-muted-foreground',
                        dayEvents && dayEvents.length > 0 && 'font-semibold',
                        isToday &&
                          isCurrentMonth &&
                          'bg-cal-today text-cal-today-foreground hover:bg-cal-today/90',
                        isCreateTarget &&
                          'ring-2 ring-cal-accent/60 bg-cal-accent/10',
                      )}
                      onClick={(e) => handleDayClick(e, day, dayKey)}
                    >
                      {format(day, 'd')}
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        <Popover
          open={!!popover}
          onOpenChange={(open) => {
            if (!open) closePopover()
          }}
          modal={false}
        >
          <PopoverAnchor asChild>
            <div
              style={{
                position: 'fixed',
                left: popover ? popover.anchorRect.right : 0,
                top: popover
                  ? popover.anchorRect.top + popover.anchorRect.height / 2
                  : 0,
                width: 0,
                height: 0,
                pointerEvents: 'none',
              }}
            />
          </PopoverAnchor>
          {popover && (
            <PopoverContent
              side="right"
              align="center"
              sideOffset={8}
              className="w-72 rounded-lg border bg-popover p-3 shadow-md outline-none"
              // The event preview opened from one of these rows is a CHILD of
              // this list, not an outside click. Radix portals it to <body>, so
              // pressing its close button (or anything else in it) arrived here
              // as "outside" and dismissed the list along with the preview.
              // Outside clicks elsewhere still dismiss as before.
              onInteractOutside={(e) => {
                if (isChildOverlayInteraction(e.target)) e.preventDefault()
              }}
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                {/*
                  The active language tag straight to Intl, not a zh/en choice.
                  Every tag in `supportedLanguages` is a BCP 47 tag the platform
                  already formats, so picking between two of them was throwing
                  away 33 correct date formats — a Norwegian user read
                  "March 4, 2026" rather than "4. mars 2026".

                  `min-w-0 truncate`: "September" is long in several locales
                  (el "Σεπτεμβρίου", lt "rugsėjo mėn.") and this popover is a
                  fixed `w-72`, so the close button was pushed off the edge.
                */}
                <button
                  type="button"
                  tabIndex={0}
                  aria-label={format(popover.day, 'PPPP')}
                  className="min-w-0 cursor-pointer truncate rounded-sm text-left text-sm font-medium hover:underline focus-visible:ring-1 focus-visible:ring-current"
                  onClick={() => {
                    closePopover()
                    onDayHeaderClick(popover.day)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      closePopover()
                      onDayHeaderClick(popover.day)
                    }
                  }}
                >
                  {popover.day.toLocaleDateString(config.language.code, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </button>
                <button
                  type="button"
                  onClick={closePopover}
                  className="text-muted-foreground hover:text-foreground ml-2 shrink-0 text-xs"
                  aria-label={t.close}
                >
                  ✕
                </button>
              </div>

              {popover.dayEvents.length > 0 ? (
                <div
                  ref={popoverListRef}
                  className="min-h-0 max-h-[260px] overflow-y-auto space-y-1.5"
                >
                  {popover.dayEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className={cn(
                        'relative w-full cursor-pointer truncate rounded-sm p-1.5 pl-3 text-left text-xs',
                        event.color,
                      )}
                      onClick={(e) => {
                        onEventClick(
                          event,
                          e.currentTarget,
                          e.clientX,
                          e.clientY,
                        )
                      }}
                      style={{
                        backgroundColor: isDark
                          ? getDarkBg(event.color)
                          : undefined,
                      }}
                    >
                      <div
                        className="absolute left-0 top-0 h-full w-1 rounded-l-sm"
                        style={{ backgroundColor: getAccent(event.color) }}
                      />
                      <div
                        style={{ color: getAccent(event.color) }}
                        className="truncate"
                      >
                        {event.title || t.unnamedEvent}
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

        {/* Mobile Form (ADR-0019): bottom sheet for a tapped day, mirroring
            the month view. Only openable below the md breakpoint. */}
        <Sheet
          open={!!daySheet}
          onOpenChange={(open) => {
            if (!open) setDaySheet(null)
          }}
        >
          <SheetContent side="bottom" className="max-h-[60dvh] gap-0 p-0">
            <SheetHeader className="border-b p-4">
              <SheetTitle>
                {daySheet ? (
                  <button
                    type="button"
                    aria-label={format(daySheet.day, 'PPPP')}
                    className="cursor-pointer text-left hover:underline"
                    onClick={() => {
                      const day = daySheet.day
                      setDaySheet(null)
                      onDayHeaderClick(day)
                    }}
                  >
                    {daySheet.day.toLocaleDateString(config.language.code, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </button>
                ) : (
                  ''
                )}
              </SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-4">
              {daySheet && daySheet.dayEvents.length > 0 ? (
                daySheet.dayEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    // `event.color` supplies the light-mode pastel
                    // background; the inline style overrides it in dark.
                    className={cn(
                      'relative w-full cursor-pointer truncate rounded-sm p-2 pl-3.5 text-left text-sm',
                      event.color,
                    )}
                    style={{
                      backgroundColor: isDark
                        ? getDarkBg(event.color)
                        : undefined,
                    }}
                    onClick={(e) => {
                      setDaySheet(null)
                      onEventClick(event, e.currentTarget, e.clientX, e.clientY)
                    }}
                  >
                    <div
                      className="absolute left-0 top-0 h-full w-1 rounded-l-sm"
                      style={{ backgroundColor: getAccent(event.color) }}
                    />
                    <div
                      style={{ color: getAccent(event.color) }}
                      className="truncate"
                    >
                      {event.title || t.unnamedEvent}
                    </div>
                  </button>
                ))
              ) : (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  {t.noEventsFound}
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </RemoveScroll>
  )
}
