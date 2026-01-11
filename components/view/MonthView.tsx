"use client"

import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, subDays } from "date-fns"
import { cn } from "@/lib/utils"
import type { CalendarEvent } from "../Calendar"

type Language = "en" | "zh"

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
  "bg-[#FFD5C6]": "#F0030F",
  "bg-[#FFE3C8]": "#FE7032",
  "bg-[#FEF0BF]": "#F3B82C",
  "bg-[#DDFFE4]": "#49CC80",
  "bg-[#E2F9FF]": "#33A6E5",
  "bg-[#FEEDFF]": "#9851FD",
  "bg-[#F7F4F3]": "#B3B4B4",
};


  return colorMapping[color] || '#3A3A3A';
}

export default function MonthView({ date, events, onEventClick, language, firstDayOfWeek, timezone }: MonthViewProps) {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

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
        const days = language === "zh" ? ["日", "一", "二", "三", "四", "五", "六"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        const orderedDays = [...days.slice(firstDayOfWeek), ...days.slice(0, firstDayOfWeek)]
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
            className="min-h-[100px] p-2 border rounded-lg border"
          >
            <div className={cn("font-medium text-sm", isSameMonth(day, date) ? "" : "text-gray-400")}>{format(day, "d")}</div>
            <div className="space-y-1">
              {visibleEvents.map((event) => (
                <div
                  key={event.id}
                  className={cn("relative text-xs truncate rounded-md p-1 cursor-pointer text-white", event.color)}
                  onClick={() => onEventClick(event)}
                >
                  <div className={cn("absolute left-0 top-0 w-2 h-full rounded-l-md")} style={{ backgroundColor: getDarkerColorClass(event.color) }} />
                  <div className="pl-1.5">{event.title}</div>
                </div>
              ))}
              {remainingCount > 0 && (
                <div className="text-xs text-muted-foreground">
                  {language === "zh" ? `还有 ${remainingCount} 个事件` : `${remainingCount} more event${remainingCount > 1 ? "s" : ""}`}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
