"use client"

import { useState, useEffect } from "react"
import { format, addDays, subDays, startOfWeek, endOfWeek, isSameDay, isToday } from "date-fns"
import { zhCN, enUS } from "date-fns/locale"
import { ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/i18n"
import type { CalendarEvent } from "../Calendar"
import { useCalendar } from "@/components/context/CalendarContext"

interface MiniCalendarSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedDate: Date
  onDateSelect: (date: Date) => void
}

export default function MiniCalendarSheet({ open, onOpenChange, selectedDate, onDateSelect }: MiniCalendarSheetProps) {
  const [language] = useLanguage()
  const { events } = useCalendar()
  const [currentDate, setCurrentDate] = useState(selectedDate)

  // Update internal date when selectedDate changes
  useEffect(() => {
    setCurrentDate(selectedDate)
  }, [selectedDate])

  // Get the current week days
  const weekStart = startOfWeek(currentDate, { weekStartsOn: language === "zh" ? 1 : 0 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: language === "zh" ? 1 : 0 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Get events for the selected day
  const dayEvents = events
    .filter((event) => isSameDay(new Date(event.startDate), currentDate))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())

  // Handle day selection
  const handleDayClick = (day: Date) => {
    setCurrentDate(day)
    onDateSelect(day)
  }

  // Handle previous/next month
  const handlePreviousWeek = () => {
    setCurrentDate((prevDate) => subDays(prevDate, 7))
  }

  const handleNextWeek = () => {
    setCurrentDate((prevDate) => addDays(prevDate, 7))
  }

  // Handle today button click
  const handleTodayClick = () => {
    const today = new Date()
    setCurrentDate(today)
    onDateSelect(today)
  }

  // Format event time
  const formatEventTime = (event: CalendarEvent) => {
    const startDate = new Date(event.startDate)
    return format(startDate, "HH:mm")
  }

  // Calculate event duration in minutes
  const calculateDuration = (event: CalendarEvent) => {
    const startDate = new Date(event.startDate)
    const endDate = new Date(event.endDate)
    const durationMs = endDate.getTime() - startDate.getTime()
    const durationMinutes = Math.round(durationMs / (1000 * 60))

    return language === "zh" ? `${durationMinutes} 分钟` : `${durationMinutes} min`
  }

  // Get day names based on language
  const getDayNames = () => {
    if (language === "zh") {
      return ["一", "二", "三", "四", "五", "六", "日"]
    } else {
      return ["M", "T", "W", "T", "F", "S", "S"]
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[350px] sm:w-[400px] p-0">
        <SheetHeader className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center">
            <SheetTitle>{language === "zh" ? "日历" : "Calendar"}</SheetTitle>
          </div>
        </SheetHeader>

        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <span className="text-lg font-medium">
                {format(currentDate, "MMMM", { locale: language === "zh" ? zhCN : enUS })}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" onClick={handleTodayClick}>
                {language === "zh" ? "今天" : "Today"}
              </Button>
              <Button variant="ghost" size="sm" onClick={handlePreviousWeek}>
                <ChevronRight className="h-4 w-4 rotate-180" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {getDayNames().map((day, index) => (
              <div key={index} className="text-xs text-muted-foreground py-1">
                {day}
              </div>
            ))}
            {weekDays.map((day) => (
              <Button
                key={day.toString()}
                variant="ghost"
                className={cn(
                  "h-10 w-10 p-0 rounded-full",
                  isSameDay(day, currentDate) && "bg-primary text-primary-foreground",
                  isToday(day) && !isSameDay(day, currentDate) && "border border-primary",
                )}
                onClick={() => handleDayClick(day)}
              >
                <span className="text-sm">{format(day, "d")}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="p-4">
          <h3 className="text-lg font-medium mb-4">
            {format(currentDate, language === "zh" ? "M月d日 EEEE" : "EEEE, MMMM d", {
              locale: language === "zh" ? zhCN : enUS,
            })}
          </h3>

          <ScrollArea className="h-[calc(100vh-300px)]">
            {dayEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {language === "zh" ? "今天没有日程" : "No events today"}
              </div>
            ) : (
              <div className="space-y-4">
                {dayEvents.map((event) => (
                  <div key={event.id} className="flex items-start">
                    <div className={cn("w-1 self-stretch rounded-full mr-3", event.color)} />
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <div className="font-medium">{event.title}</div>
                        <div className="text-muted-foreground">{formatEventTime(event)}</div>
                      </div>
                      <div className="text-sm text-muted-foreground">{calculateDuration(event)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}

