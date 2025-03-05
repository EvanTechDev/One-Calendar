"use client"

import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns"
import { cn } from "@/lib/utils"
import type { CalendarEvent } from "./Calendar"

type Language = "en" | "zh"

interface MonthViewProps {
  date: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  language: Language
  firstDayOfWeek: number
  timezone: string
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
      {monthDays.map((day) => (
        <div
          key={day.toString()}
          className={cn("min-h-[100px] p-2 border rounded-lg", isSameMonth(day, date) ? "bg-background" : "bg-muted")}
        >
          <div className="font-medium text-sm">{format(day, "d")}</div>
          <div className="space-y-1">
            {events
              .filter((event) => isSameDay(new Date(event.startDate), day))
              .map((event) => (
                <div
                  key={event.id}
                  className={cn("text-xs truncate rounded-md p-1 cursor-pointer", event.color)}
                  onClick={() => onEventClick(event)}
                >
                  {event.title}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}
