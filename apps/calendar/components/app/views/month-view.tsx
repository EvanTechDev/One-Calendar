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
import { translations, type Language } from '@zntr/i18n/calendar'
import type { CalendarEvent } from '../calendar'
import { cn } from '@zntr/utils'
import {
  EVENT_BG_TO_ACCENT,
  EVENT_BG_TO_DARK,
  DEFAULT_ACCENT,
} from '@/components/app/views/event-colors'

import type { FirstDayOfWeek } from '@/components/app/calendar-types'

interface MonthViewProps {
  date: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent, anchorEl?: HTMLElement | null) => void
  language: Language
  firstDayOfWeek: FirstDayOfWeek
  timezone: string
}

export default function MonthView({
  date,
  events,
  onEventClick,
  language,
  firstDayOfWeek,
  timezone,
}: MonthViewProps) {
  const t = translations[language]
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const today = new Date()
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')

  const startWeekDay = monthStart.getDay()
  const leadingEmptyDays = (7 + (startWeekDay - firstDayOfWeek)) % 7

  const prevMonthDays: Date[] = []
  for (let i = leadingEmptyDays; i > 0; i--) {
    prevMonthDays.push(subDays(monthStart, i))
  }

  const totalDays = [...prevMonthDays, ...monthDays]

  return (
    <div className="grid grid-cols-7 gap-1 p-4">
      {(() => {
        const orderedDays = [
          ...t.weekdays.slice(firstDayOfWeek),
          ...t.weekdays.slice(0, firstDayOfWeek),
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

        return (
          <div
            key={day.toString()}
            className="min-h-[100px] p-2 border rounded-xl border"
          >
            <div
              className={cn(
                'font-medium text-sm',
                isSameMonth(day, date) ? '' : 'text-gray-400',
                isSameMonth(day, date) && isSameDay(day, today)
                  ? 'text-[#0066FF] font-bold'
                  : '',
              )}
            >
              {format(day, 'd')}
            </div>
            <div className="space-y-1">
              {visibleEvents.map((event) => (
                <div
                  key={event.id}
                  className={cn(
                    'relative text-xs truncate rounded-md p-1 cursor-pointer text-white',
                    event.color,
                  )}
                  onClick={(e) =>
                    onEventClick(event, e.currentTarget as HTMLElement)
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
                      'absolute left-0 top-0 w-1 h-full rounded-l-md',
                    )}
                    style={{
                      backgroundColor: EVENT_BG_TO_ACCENT[event.color] ?? DEFAULT_ACCENT,
                    }}
                  />
                  <div
                    className="pl-1.5 truncate"
                    style={{ color: EVENT_BG_TO_ACCENT[event.color] ?? DEFAULT_ACCENT }}
                  >
                    {event.title}
                  </div>
                </div>
              ))}
              {remainingCount > 0 && (
                <div className="text-xs text-muted-foreground">
                  {(remainingCount === 1
                    ? t.moreEvents
                    : t.moreEventsPlural
                  ).replace('{count}', remainingCount.toString())}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
