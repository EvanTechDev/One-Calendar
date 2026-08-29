'use client'

import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  subDays,
  addDays,
} from 'date-fns'
import { translations } from '@zntr/i18n/calendar'
import type { CalendarEvent } from '../calendar'
import { cn } from '@zntr/utils'
import {
  EVENT_BG_TO_ACCENT,
  EVENT_BG_TO_DARK,
  DEFAULT_ACCENT,
  getEventAccentColor,
  getEventBackgroundColor,
} from '@/lib/event-colors'
import { isMobileViewport } from '@/lib/mobile-viewport'
import type { ViewConfig } from '@/lib/calendar-types'
import {
  isBannerEvent,
  shouldShowEventOnDay,
  layoutAllDaySegments,
} from '@/components/app/views/event-layout-engine'
import { selectionCoversDay } from '@/components/app/views/selection-range'
import { useCallback, useRef, useState } from 'react'
import { Popover, PopoverAnchor, PopoverContent } from '@zntr/ui/popover'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@zntr/ui/sheet'
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

/** Height of the day-number block at the top of each cell, in px. */
const DAY_NUMBER_BLOCK_HEIGHT = 36
/** Height of one all-day bar, in px (matches single-day event blocks). */
const ALL_DAY_BAR_HEIGHT = 24
/** Vertical gap between stacked all-day bars, in px. */
const ALL_DAY_BAR_GAP = 4
/** Horizontal inset of a bar end that does not continue past the row, px. */
const ALL_DAY_BAR_INSET = 8

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

  // Pad with next-month days so the grid always ends on a full week row.
  const trailingCount = (7 - (totalDays.length % 7)) % 7
  for (let i = 1; i <= trailingCount; i++) {
    totalDays.push(addDays(monthEnd, i))
  }

  const weeks: Date[][] = []
  for (let i = 0; i < totalDays.length; i += 7) {
    weeks.push(totalDays.slice(i, i + 7))
  }

  const allDayCandidates = events.filter((event) => isBannerEvent(event))

  // First visible day the draft selection touches — the editor's anchor cell.
  const selectionAnchorDay = selection
    ? (totalDays.find((d) => selectionCoversDay(selection, d)) ?? null)
    : null

  const [remainingPopover, setRemainingPopover] =
    useState<RemainingPopoverState | null>(null)

  const handleRemainingClick = useCallback(
    (
      e: React.MouseEvent<HTMLButtonElement>,
      day: Date,
      remainingEvents: CalendarEvent[],
    ) => {
      const cell = (e.currentTarget as HTMLElement).closest(
        '[data-day-cell]',
      ) as HTMLElement | null
      const rect = cell
        ? cell.getBoundingClientRect()
        : e.currentTarget.getBoundingClientRect()
      const key = format(day, 'yyyy-MM-dd')
      setRemainingPopover({
        key,
        anchorRect: rect,
        remainingEvents,
      })
    },
    [],
  )

  const closeRemainingPopover = useCallback(() => setRemainingPopover(null), [])

  const remainingPopoverListRef = useRef<HTMLDivElement>(null)

  // Mobile Form (ADR-0019): tapping a day cell opens a bottom sheet listing
  // that day's events — dots replace the event bars, which are too small to
  // read or tap. State is harmless on desktop: nothing sets it there because
  // the tap target only exists below the md breakpoint.
  const [daySheet, setDaySheet] = useState<{
    day: Date
    events: CalendarEvent[]
  } | null>(null)

  const openDaySheet = useCallback(
    (day: Date) => {
      const dayEvents = events.filter((event) =>
        shouldShowEventOnDay(event, day),
      )
      setDaySheet({ day, events: dayEvents })
    },
    [events],
  )

  const orderedDays = [
    ...t.weekdays.slice(firstDayOfWeek.value),
    ...t.weekdays.slice(0, firstDayOfWeek.value),
  ]

  return (
    <RemoveScroll
      enabled={!!remainingPopover}
      shards={[remainingPopoverListRef]}
      className="h-full"
    >
      <div className="flex min-h-full flex-col">
        <div className="grid grid-cols-7">
          {orderedDays.map((day) => (
            <div key={day} className="text-center font-medium text-sm py-2">
              {day}
            </div>
          ))}
        </div>

        {weeks.map((week) => {
          const segments = layoutAllDaySegments(allDayCandidates, week)
          const laneCount =
            segments.length > 0
              ? Math.max(...segments.map((s) => s.lane)) + 1
              : 0
          const lanesHeight =
            laneCount > 0
              ? laneCount * (ALL_DAY_BAR_HEIGHT + ALL_DAY_BAR_GAP)
              : 0

          return (
            <div
              key={week[0].toString()}
              className="relative grid flex-1 grid-cols-7 border-t"
            >
              {week.map((day, dayIndex) => {
                const timedEvents = events.filter(
                  (event) =>
                    !isBannerEvent(event) && shouldShowEventOnDay(event, day),
                )
                const visibleEvents = timedEvents.slice(0, 3)
                const remainingCount = timedEvents.length - visibleEvents.length

                // Highlight every cell the draft range touches; the anchor
                // attribute goes on the first visible one so the editor still
                // has something to point at when the range starts in an
                // earlier month.
                const isCreateTarget =
                  selection && selectionCoversDay(selection, day)
                const isCreateAnchor =
                  isCreateTarget &&
                  selectionAnchorDay !== null &&
                  isSameDay(day, selectionAnchorDay)

                const bannerEvents = events.filter(
                  (event) =>
                    isBannerEvent(event) && shouldShowEventOnDay(event, day),
                )
                const dotEvents = [...bannerEvents, ...timedEvents]

                return (
                  <div
                    key={day.toString()}
                    data-day-cell
                    {...(isCreateAnchor
                      ? { 'data-create-selection': true }
                      : {})}
                    className={cn(
                      'min-h-[100px] p-2 max-md:min-h-[72px] max-md:p-1',
                      dayIndex < 6 && 'border-r',
                      isCreateTarget &&
                        'bg-cal-accent/5 ring-1 ring-inset ring-cal-accent/40',
                    )}
                    // Mobile Form: the whole cell is the tap target for the
                    // bottom sheet. Guarded by matchMedia so a desktop click
                    // on the cell background stays a no-op, exactly as today.
                    onClick={() => {
                      if (isMobileViewport()) {
                        openDaySheet(day)
                      }
                    }}
                  >
                    <div
                      className="flex items-center max-md:justify-center"
                      style={{ height: DAY_NUMBER_BLOCK_HEIGHT - 12 + 'px' }}
                    >
                      <span
                        className={cn(
                          'font-medium text-sm',
                          isSameMonth(day, date) ? '' : 'text-gray-400',
                          isSameMonth(day, date) &&
                            isSameDay(day, today) &&
                            'inline-flex h-6 min-w-6 items-center justify-center rounded-lg bg-cal-today px-1 text-cal-today-foreground',
                        )}
                      >
                        {format(day, 'd')}
                      </span>
                    </div>

                    {/* Mobile Form: dots instead of event bars (ADR-0019).
                        Up to three, one per event, in the event's accent. */}
                    <div className="mt-1 hidden items-center justify-center gap-1 max-md:flex">
                      {dotEvents.slice(0, 3).map((event) => (
                        <span
                          key={event.id}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{
                            backgroundColor: getEventAccentColor(event.color),
                          }}
                        />
                      ))}
                    </div>

                    {/* Space reserved for the all-day bars overlaying the row */}
                    {lanesHeight > 0 && (
                      <div
                        className="max-md:hidden"
                        style={{ height: lanesHeight + 'px' }}
                      />
                    )}

                    <div className="space-y-1 max-md:hidden">
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
                                EVENT_BG_TO_ACCENT[event.color] ??
                                DEFAULT_ACCENT,
                            }}
                          />
                          <div
                            className="pl-1.5 truncate"
                            style={{
                              color:
                                EVENT_BG_TO_ACCENT[event.color] ??
                                DEFAULT_ACCENT,
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
                          onClick={(e) =>
                            handleRemainingClick(e, day, timedEvents.slice(3))
                          }
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

              {segments.map((segment) => {
                const { event, startIndex, span, lane } = segment
                const leftInset = segment.continuesLeft ? 0 : ALL_DAY_BAR_INSET
                const rightInset = segment.continuesRight
                  ? 0
                  : ALL_DAY_BAR_INSET
                return (
                  <div
                    key={`allday-${event.id}`}
                    data-event-id={event.id}
                    className={cn(
                      // max-md:hidden: on the Mobile Form banner events are
                      // dots in the cell like everything else (ADR-0019).
                      'absolute cursor-pointer overflow-hidden rounded-sm p-1 text-xs max-md:hidden',
                      event.color,
                      segment.continuesLeft && 'rounded-l-none',
                      segment.continuesRight && 'rounded-r-none',
                    )}
                    style={{
                      top:
                        DAY_NUMBER_BLOCK_HEIGHT +
                        lane * (ALL_DAY_BAR_HEIGHT + ALL_DAY_BAR_GAP) +
                        'px',
                      left: `calc(${startIndex} / 7 * 100% + ${leftInset}px)`,
                      width: `calc(${span} / 7 * 100% - ${leftInset + rightInset}px)`,
                      height: ALL_DAY_BAR_HEIGHT + 'px',
                      backgroundColor: getEventBackgroundColor(
                        event.color,
                        isDark,
                      ),
                      zIndex: 10 + lane,
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEventClick(
                        event,
                        e.currentTarget as HTMLElement,
                        e.clientX,
                        e.clientY,
                      )
                    }}
                  >
                    {!segment.continuesLeft && (
                      <div
                        className="absolute left-0 top-0 w-1 h-full rounded-l-sm"
                        style={{
                          backgroundColor: getEventAccentColor(event.color),
                        }}
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
              })}
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
            <div className="flex min-w-0 items-center justify-between gap-2">
              <div className="min-w-0 truncate text-sm font-medium">
                {t.events}
              </div>
              <button
                type="button"
                onClick={closeRemainingPopover}
                className="text-muted-foreground hover:text-foreground ml-2 shrink-0 text-xs"
                aria-label={t.close}
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
                    // `event.color` supplies the light-mode pastel background
                    // (the same way the year view's popover rows do); the
                    // inline style overrides it with the dark palette.
                    className={cn(
                      'relative w-full cursor-pointer truncate rounded-sm p-1.5 pl-3 text-left text-xs',
                      event.color,
                    )}
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

      {/* Mobile Form (ADR-0019): bottom sheet listing a tapped day's events.
          Only openable from the mobile tap target, so it never appears on
          desktop. Tapping an event routes through the same onEventClick the
          bars use, which the mobile overlay rule then renders full-screen. */}
      <Sheet
        open={!!daySheet}
        onOpenChange={(open) => {
          if (!open) setDaySheet(null)
        }}
      >
        <SheetContent side="bottom" className="max-h-[60dvh] gap-0 p-0">
          <SheetHeader className="border-b p-4">
            <SheetTitle>
              {daySheet ? format(daySheet.day, 'yyyy-MM-dd') : ''}
            </SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-4">
            {daySheet && daySheet.events.length > 0 ? (
              daySheet.events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  // `event.color` supplies the light-mode pastel background;
                  // the inline style overrides it with the dark palette.
                  className={cn(
                    'relative w-full cursor-pointer truncate rounded-sm p-2 pl-3.5 text-left text-sm',
                    event.color,
                  )}
                  style={{
                    backgroundColor: isDark
                      ? EVENT_BG_TO_DARK[event.color]
                      : undefined,
                  }}
                  onClick={(e) => {
                    setDaySheet(null)
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
                      color: EVENT_BG_TO_ACCENT[event.color] ?? DEFAULT_ACCENT,
                    }}
                  >
                    {event.title}
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
    </RemoveScroll>
  )
}
