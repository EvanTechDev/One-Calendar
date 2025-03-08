"use client"

import { format, isSameDay } from "date-fns"
import { zhCN, enUS } from "date-fns/locale"
import { cn } from "@/lib/utils"
import type { CalendarEvent } from "./Calendar"
import type { Language } from "@/lib/i18n"

interface DayViewProps {
  date: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  language: Language
  timezone: string
}

export default function DayView({ date, events, onEventClick, language, timezone }: DayViewProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i)

  const formatTime = (hour: number) => {
    return `${hour.toString().padStart(2, "0")}:00`
  }

  const formatDateWithTimezone = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone,
    }
    return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", options).format(date)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-[100px_1fr] border-b">
        <div className="py-2 text-center">
          <div className="text-sm text-muted-foreground">
            {format(date, "E", { locale: language === "zh" ? zhCN : enUS })}
          </div>
          <div className="text-3xl font-semibold text-blue-600">{format(date, "d")}</div>
        </div>
        <div className="p-2">{timezone}</div>
      </div>

      <div className="flex-1 grid grid-cols-[100px_1fr] overflow-auto">
        <div className="text-sm text-muted-foreground">
          {hours.map((hour) => (
            <div key={hour} className="h-[60px] relative">
              <span className="absolute -top-3 right-4">{formatTime(hour)}</span>
            </div>
          ))}
        </div>

        <div className="relative border-l">
          {hours.map((hour) => (
            <div key={hour} className="h-[60px] border-t border-gray-200" />
          ))}

          {events
            .filter((event) => isSameDay(new Date(event.startDate), date))
            .map((event) => {
              const start = new Date(event.startDate)
              const end = new Date(event.endDate)
              const startMinutes = start.getHours() * 60 + start.getMinutes()
              const duration = (end.getTime() - start.getTime()) / (1000 * 60)

              return (
                <div
                  key={event.id}
                  className={cn("absolute left-0 right-4 rounded-lg p-2 text-sm cursor-pointer", event.color)}
                  style={{
                    top: `${startMinutes}px`,
                    height: `${duration}px`,
                    opacity: 0.9,
                  }}
                  onClick={() => onEventClick(event)}
                >
                  <div className="font-medium text-white">{event.title}</div>
                  <div className="text-xs text-white/90">
                    {formatDateWithTimezone(start)} - {formatDateWithTimezone(end)}
                  </div>
                </div>
              )
            })}

          <div
            className="absolute left-0 right-0 border-t-2 border-red-500 z-10"
            style={{
              top: `${new Date().getHours() * 60 + new Date().getMinutes()}px`,
            }}
          />
        </div>
      </div>
    </div>
  )
}

