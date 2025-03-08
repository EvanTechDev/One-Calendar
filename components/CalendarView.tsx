"use client"

import { useMemo } from "react"
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  addHours,
  startOfDay,
  endOfDay,
  isSameMonth,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  startOfYear,
  endOfYear,
} from "date-fns"
import { zhCN } from "date-fns/locale"

interface CalendarViewProps {
  view: "day" | "week" | "month" | "year"
  currentDate: Date
  events: CalendarEvent[]
  onTimeSlotClick: (date: Date) => void
  onEventClick: (event: CalendarEvent) => void
}

export default function CalendarView({ view, currentDate, events, onTimeSlotClick, onEventClick }: CalendarViewProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i)

  const viewDates = useMemo(() => {
    switch (view) {
      case "day":
        return [currentDate]
      case "week":
        return eachDayOfInterval({
          start: startOfWeek(currentDate, { locale: zhCN }),
          end: endOfWeek(currentDate, { locale: zhCN }),
        })
      case "month":
        return eachDayOfInterval({
          start: startOfMonth(currentDate),
          end: endOfMonth(currentDate),
        })
      case "year":
        return eachMonthOfInterval({
          start: startOfYear(currentDate),
          end: endOfYear(currentDate),
        })
      default:
        return []
    }
  }, [view, currentDate])

  const renderDayView = () => (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-[60px_1fr] divide-x">
        <div className="sticky top-0 z-10 bg-background" />
        <div className="sticky top-0 z-10 bg-background p-2">
          {format(currentDate, "yyyy年MM月dd日", { locale: zhCN })}
        </div>
      </div>
      <div className="flex-1 grid grid-cols-[60px_1fr] divide-x overflow-auto">
        <div className="space-y-[42px] text-sm py-2">
          {hours.map((hour) => (
            <div key={hour} className="text-right pr-2">
              {`${hour.toString().padStart(2, "0")}:00`}
            </div>
          ))}
        </div>
        <div className="relative">
          {hours.map((hour) => (
            <div
              key={hour}
              className="h-[50px] border-b border-dashed hover:bg-accent/50 cursor-pointer"
              onClick={() => onTimeSlotClick(addHours(startOfDay(currentDate), hour))}
            />
          ))}
          {events
            .filter((event) => isSameDay(new Date(event.startDate), currentDate))
            .map((event) => (
              <div
                key={event.id}
                className="absolute left-0 right-0 rounded p-1 text-sm cursor-pointer"
                style={{
                  top: `${new Date(event.startDate).getHours() * 50}px`,
                  height: "50px",
                  backgroundColor: `${event.color}20`,
                  borderLeft: `3px solid ${event.color}`,
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  onEventClick(event)
                }}
              >
                {event.title}
              </div>
            ))}
        </div>
      </div>
    </div>
  )

  const renderWeekView = () => (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-[60px_repeat(7,1fr)] divide-x">
        <div className="sticky top-0 z-10 bg-background" />
        {viewDates.map((date) => (
          <div key={date.toString()} className="sticky top-0 z-10 bg-background p-2 text-center">
            <div>{format(date, "E", { locale: zhCN })}</div>
            <div>{format(date, "d")}</div>
          </div>
        ))}
      </div>
      <div className="flex-1 grid grid-cols-[60px_repeat(7,1fr)] divide-x overflow-auto">
        <div className="space-y-[42px] text-sm py-2">
          {hours.map((hour) => (
            <div key={hour} className="text-right pr-2">
              {`${hour.toString().padStart(2, "0")}:00`}
            </div>
          ))}
        </div>
        {viewDates.map((date) => (
          <div key={date.toString()} className="relative">
            {hours.map((hour) => (
              <div
                key={hour}
                className="h-[50px] border-b border-dashed hover:bg-accent/50 cursor-pointer"
                onClick={() => onTimeSlotClick(addHours(startOfDay(date), hour))}
              />
            ))}
            {events
              .filter((event) => isSameDay(new Date(event.startDate), date))
              .map((event) => (
                <div
                  key={event.id}
                  className="absolute left-0 right-0 rounded p-1 text-sm cursor-pointer"
                  style={{
                    top: `${new Date(event.startDate).getHours() * 50}px`,
                    height: "50px",
                    backgroundColor: `${event.color}20`,
                    borderLeft: `3px solid ${event.color}`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onEventClick(event)
                  }}
                >
                  {event.title}
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  )

  const renderMonthView = () => (
    <div className="grid grid-cols-7 gap-1 p-4">
      {viewDates.map((date) => (
        <div
          key={date.toString()}
          className={`min-h-[100px] p-2 border rounded ${
            isSameMonth(date, currentDate) ? "bg-background" : "bg-muted"
          }`}
          onClick={() => onTimeSlotClick(date)}
        >
          <div className="font-medium">{format(date, "d")}</div>
          <div className="space-y-1">
            {events
              .filter((event) => isSameDay(new Date(event.startDate), date))
              .map((event) => (
                <div
                  key={event.id}
                  className="text-xs truncate rounded p-1 cursor-pointer"
                  style={{
                    backgroundColor: `${event.color}20`,
                    borderLeft: `3px solid ${event.color}`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onEventClick(event)
                  }}
                >
                  {event.title}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  )

  const renderYearView = () => (
    <div className="grid grid-cols-4 gap-4 p-4">
      {viewDates.map((date) => (
        <div
          key={date.toString()}
          className="p-4 border rounded hover:bg-accent/50 cursor-pointer"
          onClick={() => onTimeSlotClick(date)}
        >
          <div className="font-medium">{format(date, "MMM", { locale: zhCN })}</div>
          <div className="mt-2 text-sm text-muted-foreground">
            {events.filter((event) => isSameMonth(new Date(event.startDate), date)).length} 个事件
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="h-full">
      {view === "day" && renderDayView()}
      {view === "week" && renderWeekView()}
      {view === "month" && renderMonthView()}
      {view === "year" && renderYearView()}
    </div>
  )
}

