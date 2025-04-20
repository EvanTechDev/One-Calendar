"use client"

import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns"
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
    'bg-blue-500': '#3C74C4',
    'bg-yellow-500': '#C39248',
    'bg-red-500': '#C14D4D',
    'bg-green-500': '#3C996C',
    'bg-purple-500': '#A44DB3',
    'bg-pink-500': '#C14D84',
    'bg-indigo-500': '#3D63B3',
    'bg-orange-500': '#C27048',
    'bg-teal-500': '#3C8D8D',
  }

  return colorMapping[color] || '#3A3A3A';
  }

export default function MonthView({ date, events, onEventClick, language, firstDayOfWeek, timezone }: MonthViewProps) {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

  return (
    <div className="grid grid-cols-7 gap-1 p-4">
      {(() => {
        const days =
          language === "zh"
            ? ["日", "一", "二", "三", "四", "五", "六"]
            : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

        // Reorder days based on firstDayOfWeek
        const orderedDays = [...days.slice(firstDayOfWeek), ...days.slice(0, firstDayOfWeek)]

        return orderedDays.map((day) => (
          <div key={day} className="text-center font-medium text-sm py-2">
            {day}
          </div>
        ))
      })()}
      {monthDays.map((day) => {
  const dayEvents = events.filter((event) => isSameDay(new Date(event.startDate), day))
  const visibleEvents = dayEvents.slice(0, 3)
  const remainingCount = dayEvents.length - visibleEvents.length

  return (
    <div
      key={day.toString()}
      className={cn("min-h-[100px] p-2 border rounded-lg", isSameMonth(day, date) ? "bg-background" : "bg-muted")}
    >
      <div className="font-medium text-sm">{format(day, "d")}</div>
      <div className="space-y-1">
        {visibleEvents.map((event) => (
          <div
            key={event.id}
            className={cn("relative text-xs truncate rounded-md p-1 cursor-pointer text-white", event.color)}
            onClick={() => onEventClick(event)}
          >
            <div className={cn("absolute left-0 top-0 w-2 h-full rounded-l-md")} style={{ backgroundColor: getDarkerColorClass(event.color) }} />
            <div className="pl-1.5">
              {event.title}
            </div>
          </div>
        ))}
        {remainingCount > 0 && (
          <div className="text-xs text-muted-foreground">
            {language === "zh"
              ? `还有 ${remainingCount} 个事件`
              : `${remainingCount} more event${remainingCount > 1 ? "s" : ""}`}
          </div>
        )}
      </div>
    </div>
  )
})}
    </div>
  )
}

