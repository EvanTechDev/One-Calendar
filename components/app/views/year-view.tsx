"use client"

import { useMemo, useState } from "react"
import { eachDayOfInterval, endOfMonth, format, isSameDay, isSameMonth, startOfWeek } from "date-fns"
import { enUS, zhCN } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { translations, type Language } from "@/lib/i18n"
import type { CalendarEvent } from "../calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface YearViewProps {
  date: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  language: Language
  firstDayOfWeek: number
  isSidebarCollapsed?: boolean
  isSidebarExpanding?: boolean
}

function getDarkerColorClass(color: string) {
  const colorMapping: Record<string, string> = {
    "bg-[#E6F6FD]": "#3B82F6",
    "bg-[#E7F8F2]": "#10B981",
    "bg-[#FEF5E6]": "#F59E0B",
    "bg-[#FFE4E6]": "#EF4444",
    "bg-[#F3EEFE]": "#8B5CF6",
    "bg-[#FCE7F3]": "#EC4899",
    "bg-[#EEF2FF]": "#6366F1",
    "bg-[#FFF0E5]": "#FB923C",
    "bg-[#E6FAF7]": "#14B8A6",
  }

  return colorMapping[color] || "#3A3A3A"
}

function getDarkModeEventBackgroundColor(color: string) {
  const darkModeColorMapping: Record<string, string> = {
    "bg-[#E6F6FD]": "#2F4655",
    "bg-[#E7F8F2]": "#2D4935",
    "bg-[#FEF5E6]": "#4F3F1B",
    "bg-[#FFE4E6]": "#6C2920",
    "bg-[#F3EEFE]": "#483A63",
    "bg-[#FCE7F3]": "#5A334A",
    "bg-[#E6FAF7]": "#1F4A47",
  }

  return darkModeColorMapping[color]
}

export default function YearView({
  date,
  events,
  onEventClick,
  language,
  firstDayOfWeek,
  isSidebarCollapsed = false,
  isSidebarExpanding = false,
}: YearViewProps) {
  const t = translations[language]
  const currentYear = date.getFullYear()
  const today = new Date()
  const locale = language === "zh-CN" ? zhCN : enUS
  const [openDayKey, setOpenDayKey] = useState<string | null>(null)
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark")

  const weekdayLabels = [...t.weekdays.slice(firstDayOfWeek), ...t.weekdays.slice(0, firstDayOfWeek)]

  const eventsByDayKey = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>()
    events.forEach((event) => {
      const eventDate = new Date(event.startDate)
      const key = format(eventDate, "yyyy-MM-dd")
      const existing = grouped.get(key) ?? []
      existing.push(event)
      grouped.set(key, existing)
    })

    grouped.forEach((dayEvents) => {
      dayEvents.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    })

    return grouped
  }, [events])

  const months = Array.from({ length: 12 }, (_, monthIndex) => {
    const monthStart = new Date(currentYear, monthIndex, 1)
    const monthEnd = endOfMonth(monthStart)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: firstDayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6 })
    const monthDays = eachDayOfInterval({ start: gridStart, end: monthEnd })

    while (monthDays.length < 42) {
      const lastDay = monthDays[monthDays.length - 1]
      monthDays.push(new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1))
    }

    return {
      monthIndex,
      label: format(monthStart, language === "zh-CN" ? "M月" : "LLLL", { locale }),
      days: monthDays,
    }
  })

  return (
    <div className="p-3 md:p-4">
      <div
        className={cn(
          "grid gap-y-4",
          isSidebarCollapsed || isSidebarExpanding
            ? "md:[grid-template-columns:repeat(auto-fit,minmax(15.5rem,15.5rem))] md:justify-between md:gap-x-6"
            : "md:grid-cols-3 md:gap-x-4",
        )}
      >
        {months.map((month) => (
          <section key={month.label} className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">{month.label}</h2>
            <div className="grid grid-cols-7 gap-y-1 text-center">
              {weekdayLabels.map((weekday) => (
                <div key={`${month.label}-${weekday}`} className="text-xs text-muted-foreground">
                  {weekday}
                </div>
              ))}

              {month.days.map((day) => {
                const dayKey = format(day, "yyyy-MM-dd")
                const isToday = isSameDay(day, today)
                const isCurrentMonth = isSameMonth(day, new Date(currentYear, month.monthIndex, 1))
                const dayEvents = eventsByDayKey.get(dayKey) ?? []

                return (
                  <Popover
                    key={`${month.label}-${day.toISOString()}`}
                    open={openDayKey === dayKey}
                    onOpenChange={(open) => setOpenDayKey(open ? dayKey : null)}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "mx-auto flex h-6 w-6 items-center justify-center rounded-full text-xs transition-colors hover:bg-accent",
                          !isCurrentMonth && "text-muted-foreground",
                          dayEvents.length > 0 && "font-semibold",
                          isToday &&
                            "bg-[#0066FF] text-white green:bg-[#24a854] orange:bg-[#e26912] azalea:bg-[#CD2F7B]",
                        )}
                      >
                        {format(day, "d")}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="right" align="start" className="w-72">
                      <div className="space-y-2">
                        <div className="text-sm font-medium">
                          {day.toLocaleDateString(language === "zh-CN" ? "zh-CN" : "en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </div>

                        {dayEvents.length > 0 ? (
                          <div className="space-y-1.5">
                            {dayEvents.map((event) => (
                              <button
                                key={event.id}
                                type="button"
                                className={cn(
                                  "relative w-full cursor-pointer truncate rounded-md p-1.5 pl-3 text-left text-xs",
                                  event.color,
                                )}
                                onClick={() => onEventClick(event)}
                                style={{
                                  backgroundColor: isDark ? getDarkModeEventBackgroundColor(event.color) : undefined,
                                }}
                              >
                                <div
                                  className="absolute left-0 top-0 h-full w-1 rounded-l-md"
                                  style={{ backgroundColor: getDarkerColorClass(event.color) }}
                                />
                                <div style={{ color: getDarkerColorClass(event.color) }} className="truncate">
                                  {event.title || t.unnamedEvent}
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">{t.noEventsFound}</div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}