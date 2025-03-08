"use client"

import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns"
import { zhCN, enUS } from "date-fns/locale"
import { cn } from "@/lib/utils"
import type { Language } from "@/lib/i18n"

interface WeekViewProps {
  date: Date
  events: any[]
  onEventClick: (event: any) => void
  language: Language
  firstDayOfWeek: number
  timezone: string
}

export default function WeekView({ date, events, onEventClick, language, firstDayOfWeek, timezone }: WeekViewProps) {
  const weekStart = startOfWeek(date, { weekStartsOn: firstDayOfWeek })
  const weekEnd = endOfWeek(date, { weekStartsOn: firstDayOfWeek })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
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
      <div className="grid grid-cols-[100px_repeat(7,1fr)] border-b">
        <div />
        {weekDays.map((day) => (
          <div key={day.toString()} className="text-center py-2">
            <div>{format(day, "E", { locale: language === "zh" ? zhCN : enUS })}</div>
            <div>{format(day, "d")}</div>
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-[100px_repeat(7,1fr)] overflow-auto">
        <div className="text-sm text-muted-foreground">
          {hours.map((hour) => (
            <div key={hour} className="h-[60px] relative">
              <span className="absolute -top-3 right-4">{formatTime(hour)}</span>
            </div>
          ))}
        </div>

        {weekDays.map((day) => (
          <div key={day.toString()} className="relative border-l">
            {hours.map((hour) => (
              <div key={hour} className="h-[60px] border-t border-gray-200" />
            ))}

            {events
              .filter((event) => isSameDay(new Date(event.startDate), day))
              .map((event) => {
                const start = new Date(event.startDate)
                const end = new Date(event.endDate)
                const startMinutes = start.getHours() * 60 + start.getMinutes()
                const duration = (end.getTime() - start.getTime()) / (1000 * 60)

                return (
                  <div
                    key={event.id}
                    className={cn("absolute left-0 right-1 rounded-lg p-2 text-sm", event.color)}
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

            {isSameDay(day, new Date()) && (
              <div
                className="absolute left-0 right-0 border-t-2 border-red-500 z-10"
                style={{
                  top: `${new Date().getHours() * 60 + new Date().getMinutes()}px`,
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

