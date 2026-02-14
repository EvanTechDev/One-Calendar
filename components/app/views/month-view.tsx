"use client"

import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, subDays } from "date-fns"
import { translations, type Language } from "@/lib/i18n"
import type { CalendarEvent } from "../calendar"
import { cn } from "@/lib/utils"

interface MonthViewProps {
  date: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  language: Language
  firstDayOfWeek: number
  timezone: string
}

function getDarkerColorClass(color: string) {
  const colorMapping: Record<string, string> = {
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


  return colorMapping[color] || '#3A3A3A';
}

function getDarkModeEventBackgroundColor(color: string) {
  const darkModeColorMapping: Record<string, string> = {
    'bg-[#E6F6FD]': '#2F4655',
    'bg-[#E7F8F2]': '#2D4935',
    'bg-[#FEF5E6]': '#4F3F1B',
    'bg-[#FFE4E6]': '#6C2920',
    'bg-[#F3EEFE]': '#483A63',
    'bg-[#FCE7F3]': '#5A334A',
    'bg-[#E6FAF7]': '#1F4A47',
  }

  return darkModeColorMapping[color]
}

export default function MonthView({ date, events, onEventClick, language, firstDayOfWeek, timezone }: MonthViewProps) {
  const t = translations[language]
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const today = new Date()
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")

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
        const orderedDays = [...t.weekdays.slice(firstDayOfWeek), ...t.weekdays.slice(0, firstDayOfWeek)]
        return orderedDays.map((day) => (
          <div key={day} className="text-center font-medium text-sm py-2">
            {day}
          </div>
        ))
      })()}

      {totalDays.map((day) => {
        const dayEvents = events.filter((event) => isSameDay(new Date(event.startDate), day))
        const visibleEvents = dayEvents.slice(0, 3)
        const remainingCount = dayEvents.length - visibleEvents.length

        return (
          <div
            key={day.toString()}
            className="min-h-[100px] p-2 border rounded-xl border"
          >
            <div
              className={cn(
                "font-medium text-sm",
                isSameMonth(day, date) ? "" : "text-gray-400",
                isSameDay(day, today)
                  ? "text-[#0066FF] font-bold green:text-[#24a854] orange:text-[#e26912] azalea:text-[#CD2F7B]"
                  : "",
              )}
            >
              {format(day, "d")}
            </div>
            <div className="space-y-1">
              {visibleEvents.map((event) => (
                <div
                  key={event.id}
                  className={cn("relative text-xs truncate rounded-md p-1 cursor-pointer text-white", event.color)}
                  onClick={() => onEventClick(event)}
                  style={{
                    opacity: 1,
                    backgroundColor: isDark ? getDarkModeEventBackgroundColor(event.color) : undefined,
                  }}
                >
                  <div className={cn("absolute left-0 top-0 w-1 h-full rounded-l-md")} style={{ backgroundColor: getDarkerColorClass(event.color) }} />
                  <div className="pl-1.5" style={{ color: getDarkerColorClass(event.color) }}>{event.title}</div>
                </div>
              ))}
              {remainingCount > 0 && (
                <div className="text-xs text-muted-foreground">
                  {(remainingCount === 1 ? t.moreEvents : t.moreEventsPlural).replace("{count}", remainingCount.toString())}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
