"use client"

import { format, isSameDay, isWithinInterval, endOfDay, startOfDay } from "date-fns"
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

  // 检查事件是否跨天
  const isMultiDayEvent = (start: Date, end: Date) => {
    return (
      start.getDate() !== end.getDate() ||
      start.getMonth() !== end.getMonth() ||
      start.getFullYear() !== end.getFullYear()
    )
  }

  // 计算事件在当天的开始和结束时间
  const getEventTimesForDay = (event: CalendarEvent, currentDate: Date) => {
    const start = new Date(event.startDate)
    const end = new Date(event.endDate)

    // 如果事件不在当天，返回null
    if (
      !isSameDay(start, currentDate) &&
      !isSameDay(end, currentDate) &&
      !isWithinInterval(currentDate, { start, end })
    ) {
      return null
    }

    // 如果是跨天事件
    if (isMultiDayEvent(start, end)) {
      // 如果当天是开始日期
      if (isSameDay(start, currentDate)) {
        return {
          start,
          end: endOfDay(currentDate),
          isPartial: true,
          position: "start",
        }
      }
      // 如果当天是结束日期
      else if (isSameDay(end, currentDate)) {
        return {
          start: startOfDay(currentDate),
          end,
          isPartial: true,
          position: "end",
        }
      }
      // 如果当天在事件中间
      else {
        return {
          start: startOfDay(currentDate),
          end: endOfDay(currentDate),
          isPartial: true,
          position: "middle",
        }
      }
    }

    // 如果不是跨天事件
    return { start, end, isPartial: false, position: "full" }
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
            .map((event) => {
              const eventTimes = getEventTimesForDay(event, date)
              if (!eventTimes) return null
              return { ...event, ...eventTimes }
            })
            .filter(Boolean)
            .map((event) => {
              const start = event.start
              const end = event.end

              if (!start || !end) return null

              const startMinutes = start.getHours() * 60 + start.getMinutes()
              const endMinutes = end.getHours() * 60 + end.getMinutes()
              const duration = endMinutes - startMinutes

              // 确保事件不会超出当天的时间范围
              const maxEndMinutes = 24 * 60 // 最大到午夜
              const displayDuration = Math.min(duration, maxEndMinutes - startMinutes)

              let positionLabel = ""
              if (event.isPartial) {
                if (event.position === "start") {
                  positionLabel = " (继续...)"
                } else if (event.position === "end") {
                  positionLabel = " (...结束)"
                } else if (event.position === "middle") {
                  positionLabel = " (...继续...)"
                }
              }

              return (
                <div
                  key={event.id}
                  className={cn("absolute left-0 right-4 rounded-lg p-2 text-sm cursor-pointer", event.color)}
                  style={{
                    top: `${startMinutes}px`,
                    height: `${displayDuration}px`,
                    opacity: 0.9,
                  }}
                  onClick={() => onEventClick(event)}
                >
                  <div className="font-medium text-white">
                    {event.title}
                    {positionLabel}
                  </div>
                  <div className="text-xs text-white/90">
                    {formatDateWithTimezone(new Date(event.startDate))} -{" "}
                    {formatDateWithTimezone(new Date(event.endDate))}
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

