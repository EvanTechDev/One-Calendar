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
import { isChildOverlayInteraction } from '@/lib/popover-nesting'
import type { ViewConfig } from '@/lib/calendar-types'
import {
  isBannerEvent,
  layoutAllDaySegments,
  barLanesByColumn,
} from '@/components/app/views/event-layout-engine'
import { selectionCoversDay } from '@/components/app/views/selection-range'
import { eventsOnDay, useEventsByDay } from '@/hooks/use-events-by-day'
import { useScrollLock } from '@/hooks/use-scroll-lock'
import { useCallback, useRef, useState } from 'react'
import type { RefObject } from 'react'
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
  /** The day number was clicked: open that day in the day view. */
  onDayNumberClick: (day: Date) => void
  /**
   * Empty space in a cell was clicked: create an event on that day.
   *
   * Deliberately no anchor element. Creating from the sidebar or the N
   * shortcut passes none either, and the editor finds a position on its own;
   * the cell is already covered by the selection box the editor anchors to.
   * Desktop only — on mobile the whole cell is the tap target for the day
   * sheet (ADR-0019), so the two cannot be told apart.
   */
  onCellClick: (day: Date) => void
  /**
   * The scrollable grid wrapper in `calendar.tsx`. Locked while the "more
   * events" popover is open — `RemoveScroll` alone leaves it scrollable by
   * keyboard, scrollbar drag and focus.
   */
  scrollContainerRef?: RefObject<HTMLElement | null>
  config: ViewConfig
}

/** Height of the day-number block at the top of each cell, in px. */
const DAY_NUMBER_BLOCK_HEIGHT = 36
/** Height of one all-day bar, in px. */
const ALL_DAY_BAR_HEIGHT = 24
/** Vertical gap between stacked all-day bars, in px. */
const ALL_DAY_BAR_GAP = 4
/** Horizontal inset of a bar end that does not continue past the row, px. */
const ALL_DAY_BAR_INSET = 8
/** Vertical space one all-day bar lane occupies, px (bar plus its gap). */
const ALL_DAY_BAR_LANE = ALL_DAY_BAR_HEIGHT + ALL_DAY_BAR_GAP
/**
 * Breathing room between the day number and whatever follows it in a cell, px.
 *
 * A cell reserves `max(lanesOverThisDay * ALL_DAY_BAR_LANE, DAY_NUMBER_GAP)`,
 * so this is the floor for a day no all-day bar covers — the blank-slot bug was
 * a day inheriting the whole row's lane count, not this floor. A day a bar does
 * cover reserves its real lanes and so starts its event list lower than its
 * bar-less neighbours; that gap is the price of not showing a phantom empty
 * slot, and it is only visible in a week that has an all-day event.
 */
const DAY_NUMBER_GAP = 7
/**
 * Gap between the last all-day bar over a day and that day's timed events, px.
 *
 * A lane is `ALL_DAY_BAR_HEIGHT + ALL_DAY_BAR_GAP`, so the lane's trailing gap
 * looks like it belongs between two bars — and between two bars it does. But
 * the bars are positioned from the ROW's top (`DAY_NUMBER_BLOCK_HEIGHT`) while
 * a cell's own flow reaches its band `ALL_DAY_BAR_GAP` higher than that: the
 * cell's `p-2` and the shortened day-number block already sit below the row's
 * offset line. That offset is exactly the size of the trailing gap, so the last
 * bar ended flush against the first timed event with nothing between them.
 * Reserving the gap here puts it back, so a day with an all-day bar reads the
 * same as one without.
 */
const ALL_DAY_BAND_TRAILING_GAP = ALL_DAY_BAR_GAP

/** Sides of a cell the draft-selection outline has to paint. */
interface SelectionSides {
  top: boolean
  right: boolean
  bottom: boolean
  left: boolean
}

/**
 * The sides of one selected cell that no selected NEIGHBOUR already paints.
 *
 * Selected cells used to carry `ring-1 ring-inset`, which paints all four sides
 * of every selected cell — so the edge two adjacent selected days share was
 * painted twice and read as a doubled border. This leaves each interior edge to
 * the neighbour, and a contiguous run reads as one outlined block.
 *
 * Neighbours are GEOMETRIC, not merely chronological. Weeks are contiguous, so
 * the day above/below is ±7 days; but the day to the left shares an edge only
 * when it is in the same row, and the day to the right only when it is not the
 * last column. A range crossing a row boundary must therefore paint both of the
 * row-end edges — they are at opposite ends of the grid, not one line between
 * two cells.
 */
function selectionSides(
  day: Date,
  dayIndex: number,
  selection: { start: Date; end: Date },
): SelectionSides {
  return {
    top: !selectionCoversDay(selection, subDays(day, 7)),
    right: dayIndex === 6 || !selectionCoversDay(selection, addDays(day, 1)),
    bottom: !selectionCoversDay(selection, addDays(day, 7)),
    left: dayIndex === 0 || !selectionCoversDay(selection, subDays(day, 1)),
  }
}

/**
 * The cell outline as one inset box-shadow per side.
 *
 * A ring cannot express this: it paints all four sides or none, and per
 * element. Comma-separated inset shadows are declared independently, which is
 * what lets an interior edge be left unpainted. Built here rather than as
 * utility classes because the side set is decided per cell at render time, and
 * Tailwind only sees class names that appear literally in the source.
 *
 * `color-mix(in oklab, … 40%)` is how `ring-cal-accent/40` resolves; the
 * highlight is unchanged, only the doubled edge is gone.
 *
 * `--cal-accent`, NOT `--color-cal-accent`. The `@theme inline` block in
 * `globals.css` tells Tailwind to substitute these values into utilities at
 * build time rather than emit the `--color-*` variables, so only the underlying
 * property exists at runtime — referencing the `--color-` name leaves the
 * `color-mix()` invalid, which drops the whole declaration and leaves the cell
 * with no outline at all. jsdom cannot see that, so a test pins it.
 */
function selectionOutline(sides: SelectionSides): string {
  const edge = (offset: string) =>
    `inset ${offset} 0 0 0 color-mix(in oklab, var(--cal-accent) 40%, transparent)`
  return [
    sides.top && edge('0 1px'),
    sides.right && edge('-1px 0'),
    sides.bottom && edge('0 -1px'),
    sides.left && edge('1px 0'),
  ]
    .filter(Boolean)
    .join(', ')
}

export default function MonthView({
  date,
  events,
  onEventClick,
  onDayNumberClick,
  onCellClick,
  scrollContainerRef,
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

  useScrollLock(scrollContainerRef, remainingPopover !== null)

  const handleRemainingClick = useCallback(
    (
      e: React.MouseEvent<HTMLButtonElement>,
      day: Date,
      remainingEvents: CalendarEvent[],
    ) => {
      // The cell itself opens the create-event popover. Without this the click
      // bubbles up and both popovers open on top of each other.
      e.stopPropagation()
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
    events: readonly CalendarEvent[]
  } | null>(null)

  // One index of events by day for the whole grid, instead of a full scan of
  // the event list per day cell — and this view asks three times per cell, so
  // it was making ~84 passes over the event list on every render.
  const eventsByDay = useEventsByDay(events)

  const openDaySheet = useCallback(
    (day: Date) => {
      setDaySheet({ day, events: eventsOnDay(eventsByDay, day) })
    },
    [eventsByDay],
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
          // Space each CELL reserves for the all-day bars over it — per day
          // column, not for the whole row. A day no bar covers owes only the
          // minimum gap; giving it the row's lane count is what opened the
          // blank event-sized slot next to a single-day all-day event.
          const barLanes = barLanesByColumn(segments, week.length)

          return (
            <div
              key={week[0].toString()}
              className="relative grid flex-1 grid-cols-7 border-t"
            >
              {week.map((day, dayIndex) => {
                const timedEvents = eventsOnDay(eventsByDay, day).filter(
                  (event) => !isBannerEvent(event),
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

                const bannerEvents = eventsOnDay(eventsByDay, day).filter(
                  (event) => isBannerEvent(event),
                )
                const dotEvents = [...bannerEvents, ...timedEvents]

                // All-day lanes over THIS day column. barLanesByColumn answers
                // -1 for a column no bar reaches, which reads as a negative
                // reserve — floored to 0 here so the band arithmetic below is
                // about lanes that exist.
                const lanes = Math.max(barLanes[dayIndex] ?? 0, 0)

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
                      isCreateTarget && 'bg-cal-accent/5',
                    )}
                    style={
                      selection && isCreateTarget
                        ? {
                            boxShadow: selectionOutline(
                              selectionSides(day, dayIndex, selection),
                            ),
                          }
                        : undefined
                    }
                    // Mobile Form: the whole cell is the tap target for the
                    // bottom sheet. Guarded by matchMedia so a desktop click
                    // on the cell background stays a no-op, exactly as today.
                    onClick={() => {
                      // Mobile Form: the whole cell is the tap target for the
                      // bottom sheet, so it must not also create.
                      if (isMobileViewport()) {
                        openDaySheet(day)
                        return
                      }
                      // Event blocks and all-day bars stop propagation, so
                      // this only fires on genuinely empty cell space.
                      onCellClick(day)
                    }}
                  >
                    {/* The strip is a layout box, not a target. Making it the
                        button meant the whole cell width above the events
                        jumped to the day view, so aiming for empty space near
                        the number took you somewhere else instead of opening
                        the editor. Only the number itself navigates; the rest
                        of the strip is cell space like anywhere else. */}
                    <div
                      className="flex items-center max-md:justify-center"
                      style={{ height: DAY_NUMBER_BLOCK_HEIGHT - 12 + 'px' }}
                    >
                      <span
                        className={cn(
                          'cursor-pointer',
                          // leading-6 gives every day the same 24px line box the
                          // today chip occupies (h-6), so the number always
                          // ends at the block's bottom edge. Without it a bare
                          // day number is only as tall as text-sm's line height
                          // and floats inside the block, leaving today looking
                          // flush against its events while its neighbours do
                          // not — the event blocks then read as misaligned.
                          'font-medium text-sm leading-6',
                          isSameMonth(day, date) ? '' : 'text-gray-400',
                          isSameMonth(day, date) &&
                            isSameDay(day, today) &&
                            'inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-cal-today px-1 text-cal-today-foreground',
                        )}
                        role="button"
                        tabIndex={0}
                        // The span's own text is just "15", so a screen reader
                        // needs the full date to name the control.
                        aria-label={format(day, 'PPPP')}
                        onClick={(e) => {
                          // Otherwise the click also reaches the cell and
                          // opens the editor for the same day.
                          e.stopPropagation()
                          onDayNumberClick(day)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            e.stopPropagation()
                            onDayNumberClick(day)
                          }
                        }}
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

                    {/* Room for the all-day bars over this day, floored at the day-number
                        gap. See DAY_NUMBER_GAP. */}
                    <div
                      className="max-md:hidden"
                      data-all-day-band
                      style={{
                        height:
                          Math.max(lanes * ALL_DAY_BAR_LANE, DAY_NUMBER_GAP) +
                          (lanes > 0 ? ALL_DAY_BAND_TRAILING_GAP : 0) +
                          'px',
                      }}
                    />

                    <div className="space-y-1 max-md:hidden">
                      {visibleEvents.map((event) => (
                        <div
                          key={event.id}
                          data-event-id={event.id}
                          className={cn(
                            'relative text-xs truncate rounded-sm p-1 cursor-pointer text-white',
                            event.color,
                          )}
                          onClick={(e) => {
                            // The cell opens the create-event popover. Without
                            // this the click bubbles up, the editor opens on
                            // top of the preview this handler just asked for,
                            // and the event never looks like it opened at all.
                            // Same reason the all-day bars and the day number
                            // stop here.
                            e.stopPropagation()
                            onEventClick(
                              event,
                              e.currentTarget as HTMLElement,
                              e.clientX,
                              e.clientY,
                            )
                          }}
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
                        lane * ALL_DAY_BAR_LANE +
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
