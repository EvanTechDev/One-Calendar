'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format, startOfWeek, differenceInCalendarDays } from 'date-fns'
import { WEEKDAY_LABELS, toMondayIndex } from '../analytics-utils'

interface HeatmapDatum {
  date: Date
  count: number
}

interface YearHeatmapChartProps {
  data: HeatmapDatum[]
}

const levelClasses = [
  'bg-muted',
  'bg-emerald-200 dark:bg-emerald-900',
  'bg-emerald-300 dark:bg-emerald-700',
  'bg-emerald-500 dark:bg-emerald-600',
  'bg-emerald-700 dark:bg-emerald-500',
]

export function YearHeatmapChart({ data }: YearHeatmapChartProps) {
  const year = new Date().getFullYear()
  const firstDay = new Date(year, 0, 1)
  const gridStart = startOfWeek(firstDay, { weekStartsOn: 1 })

  const maxCount = data.reduce((max, item) => Math.max(max, item.count), 0)
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
        <CardTitle>全年日程热力图</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="flex min-w-[840px] gap-2">
            <div className="mt-5 grid grid-rows-7 gap-1 text-xs text-muted-foreground">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="h-3 leading-3">
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-flow-col grid-rows-7 gap-1">
              {data.map(({ date, count }) => {
                const dayIndex = toMondayIndex(date)
                const weekIndex = Math.floor(
                  differenceInCalendarDays(date, gridStart) / 7,
                )
                return (
                  <div
                    key={date.toISOString()}
                    className={`h-3 w-3 rounded-sm ${levelClasses[getLevel(count)]}`}
                    style={{ gridColumnStart: weekIndex + 1, gridRowStart: dayIndex + 1 }}
                    title={`${format(date, 'yyyy-MM-dd')} · ${count} 个日程`}
                  />
                )
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
