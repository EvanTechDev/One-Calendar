"use client"

import { eachDayOfInterval, endOfMonth, format, isSameDay, isSameMonth, startOfWeek } from "date-fns"
import { enUS, zhCN } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { translations, type Language } from "@/lib/i18n"

interface YearViewProps {
  date: Date
  language: Language
  firstDayOfWeek: number
}

export default function YearView({ date, language, firstDayOfWeek }: YearViewProps) {
  const t = translations[language]
  const currentYear = date.getFullYear()
  const today = new Date()
  const locale = language === "zh-CN" ? zhCN : enUS

  const weekdayLabels = [...t.weekdays.slice(firstDayOfWeek), ...t.weekdays.slice(0, firstDayOfWeek)]

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
    <div className="p-4 md:p-5">
      <div className="grid gap-5 md:grid-cols-3">
        {months.map((month) => (
          <section key={month.label} className="space-y-1.5">
            <h2 className="text-xl font-semibold tracking-tight">{month.label}</h2>
            <div className="grid grid-cols-7 gap-y-1.5 text-center">
              {weekdayLabels.map((weekday) => (
                <div key={`${month.label}-${weekday}`} className="text-sm text-muted-foreground">
                  {weekday}
                </div>
              ))}

              {month.days.map((day) => {
                const isToday = isSameDay(day, today)
                const isCurrentMonth = isSameMonth(day, new Date(currentYear, month.monthIndex, 1))

                return (
                  <div
                    key={`${month.label}-${day.toISOString()}`}
                    className={cn(
                      "mx-auto flex h-7 w-7 items-center justify-center rounded-full text-sm",
                      !isCurrentMonth && "text-muted-foreground",
                      isToday &&
                        "bg-[#0066FF] text-white green:bg-[#24a854] orange:bg-[#e26912] azalea:bg-[#CD2F7B] pink:bg-[#FFAFA5] crimson:bg-[#9B0032]",
                    )}
                  >
                    {format(day, "d")}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
