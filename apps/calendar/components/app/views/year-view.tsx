'use client'

import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfWeek,
} from 'date-fns'
import { isZhLanguage, translations } from '@zntr/i18n/calendar'
import type { CalendarEvent } from '../calendar'
import { useCallback, useMemo, useRef, useState } from 'react'
import { cn } from '@zntr/utils'
import type { ViewConfig } from '@/components/app/calendar-types'
import { createPortal } from 'react-dom'

interface YearViewProps {
  date: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent, anchorEl?: HTMLElement | null) => void
  config: ViewConfig
  isSidebarCollapsed?: boolean
  isSidebarExpanding?: boolean
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
  isSidebarCollapsed = false,
  isSidebarExpanding = false,
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
      const key = `${day.getMonth()}-${dayKey}`
      if (popover?.key === key) {
        setPopover(null)
        return
      }
      const rect = e.currentTarget.getBoundingClientRect()
      const dayEvents = eventsByDayKey.get(dayKey) ?? []
      setPopover({ key, anchorRect: rect, day, dayEvents })
    },
    [popover, eventsByDayKey],
  )

  const closePopover = useCallback(() => setPopover(null), [])

  return (
    <div className="p-3 md:p-4" ref={containerRef}>
      <div
        className={cn(
          'grid gap-y-4',
          isSidebarCollapsed || isSidebarExpanding
            ? 'md:[grid-template-columns:repeat(auto-fit,minmax(15.5rem,15.5rem))] md:justify-between md:gap-x-6'
            : 'md:grid-cols-3 md:gap-x-6',
        )}
      >
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

                return (
                  <button
                    key={`${month.label}-${dayKey}`}
                    type="button"
                    className={cn(
                      'mx-auto flex h-6 w-6 items-center justify-center rounded-full text-xs transition-colors hover:bg-accent',
                      !isCurrentMonth && 'text-muted-foreground',
                      dayEvents && dayEvents.length > 0 && 'font-semibold',
                      isToday &&
                        isCurrentMonth &&
                        'bg-[#0052CC] text-white hover:bg-[#0047B3]',
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

      {popover &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            className="fixed z-50 w-72 rounded-lg border bg-popover p-3 shadow-md outline-none"
            style={{
              left: Math.min(popover.anchorRect.left, window.innerWidth - 300),
              top: popover.anchorRect.bottom + 4,
            }}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  {popover.day.toLocaleDateString(
                    isZhLanguage(config.language.code as any)
                      ? 'zh-CN'
                      : 'en-US',
                    {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    },
                  )}
                </div>
                <button
                  type="button"
                  onClick={closePopover}
                  className="text-muted-foreground hover:text-foreground ml-2 text-xs"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {popover.dayEvents.length > 0 ? (
                <div className="space-y-1.5">
                  {popover.dayEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className={cn(
                        'relative w-full cursor-pointer truncate rounded-md p-1.5 pl-3 text-left text-xs',
                        event.color,
                      )}
                      onClick={() => {
                        onEventClick(event)
                        closePopover()
                      }}
                      style={{
                        backgroundColor: isDark
                          ? getDarkBg(event.color)
                          : undefined,
                      }}
                    >
                      <div
                        className="absolute left-0 top-0 h-full w-1 rounded-l-md"
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
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
