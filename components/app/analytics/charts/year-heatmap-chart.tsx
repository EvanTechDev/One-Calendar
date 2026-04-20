'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  addDays,
  differenceInDays,
  endOfYear,
  format,
  getDay,
  startOfWeek,
  startOfYear,
} from 'date-fns'
import { translations, useLanguage } from '@/lib/i18n'

interface HeatmapDatum {
  date: Date
  count: number
}

interface YearHeatmapChartProps {
  data: HeatmapDatum[]
}

const intensityClasses = [
  'bg-muted',
  'bg-emerald-100 dark:bg-emerald-900',
  'bg-emerald-300 dark:bg-emerald-700',
  'bg-emerald-500 dark:bg-emerald-600',
  'bg-emerald-700 dark:bg-emerald-500',
]

export function YearHeatmapChart({ data }: YearHeatmapChartProps) {
  const [language] = useLanguage()
  const t = translations[language]
  const selectedYear = new Date().getFullYear()
  const firstDayOfYear = startOfYear(new Date(selectedYear, 0, 1))
  const lastDayOfYear = endOfYear(new Date(selectedYear, 11, 31))
  const startDay = startOfWeek(firstDayOfYear, { weekStartsOn: 1 })
  const endDay = addDays(lastDayOfYear, 7 - ((getDay(lastDayOfYear) + 6) % 7) - 1)
  const totalDays = differenceInDays(endDay, startDay) + 1
  const totalWeeks = Math.ceil(totalDays / 7)
  const countMap = new Map(data.map((item) => [format(item.date, 'yyyy-MM-dd'), item.count]))
  const maxCount = data.reduce((max, item) => Math.max(max, item.count), 0)

  const weekdayLabels = [
    t.weekdays[1],
    t.weekdays[2],
    t.weekdays[3],
    t.weekdays[4],
    t.weekdays[5],
    t.weekdays[6],
    t.weekdays[0],
  ]

  const allDates = Array.from({ length: totalDays }).map((_, index) =>
    addDays(startDay, index),
  )

  const monthLabels = Array.from({ length: 12 }).flatMap((_, month) => {
    const firstDayOfMonth = new Date(selectedYear, month, 1)
    if (firstDayOfMonth < startDay || firstDayOfMonth > endDay) return []
    const dayIndex = differenceInDays(firstDayOfMonth, startDay)
    const weekIndex = Math.floor(dayIndex / 7)
    return [{ weekIndex, label: t.months[month] }]
  })

  const getLevel = (count: number): number => {
    if (count === 0 || maxCount === 0) return 0
    const ratio = count / maxCount
    if (ratio <= 0.25) return 1
    if (ratio <= 0.5) return 2
    if (ratio <= 0.75) return 3
    return 4
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.analyticsYearHeatmapTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-2">
          <div
            className="relative"
            style={{ minWidth: `${Math.max(totalWeeks * 16 + 72, 760)}px`, paddingTop: '20px' }}
          >
            <div className="absolute left-12 right-0 top-0">
              {monthLabels.map((month) => (
                <div
                  key={`${month.label}-${month.weekIndex}`}
                  className="absolute text-xs text-muted-foreground"
                  style={{ left: `${month.weekIndex * 16}px` }}
                >
                  {month.label}
                </div>
              ))}
            </div>

            <div className="flex">
              <div className="flex w-10 flex-col pr-2">
                {weekdayLabels.map((day, index) => (
                  <div
                    key={day}
                    className="mb-1 h-3 text-right text-xs leading-3 text-muted-foreground"
                  >
                    {index % 2 === 0 ? day : ''}
                  </div>
                ))}
              </div>

              <div className="flex gap-1">
                {Array.from({ length: totalWeeks }).map((_, weekIndex) => (
                  <div key={`week-${weekIndex}`} className="space-y-1">
                    {Array.from({ length: 7 }).map((_, dayIndex) => {
                      const date = allDates[weekIndex * 7 + dayIndex]
                      const isCurrentYear = date.getFullYear() === selectedYear
                      const key = format(date, 'yyyy-MM-dd')
                      const count = isCurrentYear ? (countMap.get(key) ?? 0) : 0
                      return (
                        <div
                          key={key}
                          className={`h-3 w-3 rounded-sm transition-colors hover:ring-1 hover:ring-ring ${
                            isCurrentYear ? intensityClasses[getLevel(count)] : 'bg-transparent'
                          }`}
                          title={isCurrentYear ? `${key}: ${count} ${t.analyticsScheduleUnit}` : ''}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center text-xs text-muted-foreground">
          <span className="mr-2">{t.less}</span>
          <div className="flex gap-1">
            {intensityClasses.map((cls) => (
              <div key={cls} className={`h-3 w-3 rounded-sm ${cls}`} />
            ))}
          </div>
          <span className="ml-2">{t.more}</span>
        </div>
      </CardContent>
    </Card>
  )
}
