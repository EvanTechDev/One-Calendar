"use client"

import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns"
import { cn } from "@/lib/utils"
import type { CalendarEvent } from "./Calendar"

interface MonthViewProps {
  date: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
}

export default function MonthView({ date, events, onEventClick }: MonthViewProps) {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

  return (
    <div className="grid grid-cols-7 gap-1 p-4">
      {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
        <div key={day} className="text-center font-medium text-sm py-2">
          {day}
        </div>
      ))}
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
