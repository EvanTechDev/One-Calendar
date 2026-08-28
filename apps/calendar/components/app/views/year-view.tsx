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
import { Popover, PopoverAnchor, PopoverContent } from '@zntr/ui/popover'
import { RemoveScroll } from 'react-remove-scroll'

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

const COLOR_TO_ACCENT: Record<string, string> = {
  'bg-[#E6F6FD]': '#3B82F6',
  'bg-[#E7F8F2]': '#10B981',
  'bg-[#FEF5E6]': '#F59E0B',
  'bg-[#FFE4E6]': '#EF4444',
  'bg-[#F3EEFE]': '#8B5CF6',
  'bg-[#FCE7F3]': '#EC4899',
  'bg-[#EEF2FF]': '#6366F1',
  'bg-[#FFF0E5]': '#FB923C',
  'bg-[#E6FAF7]': '#14B8A6',
}

const DARK_BG: Record<string, string> = {
  'bg-[#E6F6FD]': '#2F4655',
  'bg-[#E7F8F2]': '#2D4935',
  'bg-[#FEF5E6]': '#4F3F1B',
  'bg-[#FFE4E6]': '#6C2920',
  'bg-[#F3EEFE]': '#483A63',
  'bg-[#FCE7F3]': '#5A334A',
  'bg-[#E6FAF7]': '#1F4A47',
}

function getAccent(color: string) {
  return COLOR_TO_ACCENT[color] || '#3A3A3A'
}

function getDarkBg(color: string) {
  return DARK_BG[color]
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

  const eventsByDayKey = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>()
    events.forEach((event) => {
      const eventDate = new Date(event.startDate)
      const key = format(eventDate, 'yyyy-MM-dd')
      const existing = grouped.get(key) ?? []
      existing.push(event)
      grouped.set(key, existing)
    })

    grouped.forEach((dayEvents) => {
      dayEvents.sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      )
    })

    return grouped
  }, [events])

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

  const handleDayClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, day: Date, dayKey: string) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const dayEvents = eventsByDayKey.get(dayKey) ?? []
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
                <div className="min-w-0 truncate text-sm font-medium">
                  {popover.day.toLocaleDateString(config.language.code, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
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
      </div>
    </RemoveScroll>
  )
}
