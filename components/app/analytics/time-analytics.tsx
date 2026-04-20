'use client'

import { useMemo, useState } from 'react'
import { differenceInCalendarDays, format, getDay } from 'date-fns'
import type { CalendarEvent } from '../calendar'
import type { CalendarCategory } from '../sidebar/sidebar'
import {
  addDurationByDayCategory,
  calculateDaySpanInHours,
  filterEventsInRange,
  formatHourRange,
  generateRangeDays,
  getMonthDays,
  groupDayKey,
  groupMonthKey,
  mapEventsToAnalyticsEvents,
  normalizeChartColor,
  resolveDateRange,
  type AnalyticsRangePreset,
  WEEKDAY_LABELS,
} from './analytics-utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DailyMonthlyCountChart } from './charts/daily-monthly-count-chart'
import { YearHeatmapChart } from './charts/year-heatmap-chart'
import { CategoryDonutChart } from './charts/category-donut-chart'
import { CategoryAverageDurationChart } from './charts/category-average-duration-chart'
import { WeekdayStackedDurationChart } from './charts/weekday-stacked-duration-chart'
import { AnalyticsMetricsGrid } from './metrics/analytics-metrics-grid'
import { translations, useLanguage } from '@/lib/i18n'

interface TimeAnalyticsProps {
  events: CalendarEvent[]
  calendars?: CalendarCategory[]
}

const dayName = (date: Date): string => {
  const day = getDay(date)
  if (day === 0) return WEEKDAY_LABELS[6]
  return WEEKDAY_LABELS[day - 1]
}

export default function TimeAnalyticsComponent({ events, calendars = [] }: TimeAnalyticsProps) {
  const [language] = useLanguage()
  const t = translations[language]
  const [preset, setPreset] = useState<AnalyticsRangePreset>('month')
  const [countMode, setCountMode] = useState<'day' | 'month'>('day')

  const now = useMemo(() => new Date(), [])
  const dateRange = useMemo(() => resolveDateRange(preset, now), [preset, now])

  const normalizedEvents = useMemo(() => mapEventsToAnalyticsEvents(events), [events])
  const rangeEvents = useMemo(() => filterEventsInRange(normalizedEvents, dateRange), [normalizedEvents, dateRange])

  const categoryMeta = useMemo(() => {
    return new Map(
      calendars.map((calendar) => [
        calendar.id,
        {
          name: calendar.name,
          color: normalizeChartColor(calendar.color),
        },
      ]),
    )
  }, [calendars])

  const resolveCategoryLabel = (categoryId: string): string => {
    if (categoryId === 'uncategorized') return t.uncategorized
    return categoryMeta.get(categoryId)?.name ?? categoryId
  }

  const resolveColorName = (color: string): string => {
    const normalized = color.toLowerCase()
    if (normalized === '#3b82f6') return t.colorBlue
    if (normalized === '#10b981') return t.colorGreen
    if (normalized === '#f59e0b') return t.colorYellow
    if (normalized === '#ef4444') return t.colorRed
    if (normalized === '#8b5cf6') return t.colorPurple
    if (normalized === '#ec4899') return t.colorPink
    if (normalized === '#14b8a6') return t.colorTeal
    return color
  }


  const countChart = useMemo(() => {
    const seriesMeta = new Map<string, { label: string; color: string; totalCount: number }>()
    const dailyBuckets = new Map<string, Record<string, number>>()
    const monthlyBuckets = new Map<string, Record<string, number>>()

    rangeEvents.forEach((event) => {
      const seriesColor = event.color
      const seriesKey = seriesColor
      const seriesLabel = resolveColorName(seriesColor)
      const previous = seriesMeta.get(seriesKey)
      seriesMeta.set(seriesKey, {
        label: previous?.label ?? seriesLabel,
        color: seriesColor,
        totalCount: (previous?.totalCount ?? 0) + 1,
      })

      const dayKey = groupDayKey(event.start)
      const monthKey = groupMonthKey(event.start)

      const dayBucket = dailyBuckets.get(dayKey) ?? {}
      dayBucket[seriesKey] = (dayBucket[seriesKey] ?? 0) + 1
      dailyBuckets.set(dayKey, dayBucket)

      const monthBucket = monthlyBuckets.get(monthKey) ?? {}
      monthBucket[seriesKey] = (monthBucket[seriesKey] ?? 0) + 1
      monthlyBuckets.set(monthKey, monthBucket)
    })

    const series = Array.from(seriesMeta.entries())
      .sort((a, b) => b[1].totalCount - a[1].totalCount)
      .map(([key, value]) => ({
        key,
        label: value.label,
        color: value.color,
      }))

    const dailyData = Array.from(dailyBuckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, values]) => ({ label, ...values }))

    const monthlyData = Array.from(monthlyBuckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, values]) => ({ label, ...values }))

    return { series, dailyData, monthlyData }
  }, [categoryMeta, rangeEvents, resolveColorName])

  const heatmapData = useMemo(() => {
    const currentYear = now.getFullYear()
    const days = getMonthDays(currentYear)
    const counts = new Map<string, number>()
    normalizedEvents.forEach((event) => {
      if (event.start.getFullYear() !== currentYear) return
      const key = groupDayKey(event.start)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })

    return days.map((date) => ({
      date,
      count: counts.get(groupDayKey(date)) ?? 0,
    }))
  }, [normalizedEvents, now])

  const categoryDonutData = useMemo(() => {
    const categoryCounts = new Map<string, { count: number; color: string }>()
    rangeEvents.forEach((event) => {
      const category = categoryMeta.get(event.category)
      const label = resolveCategoryLabel(event.category)
      const prev = categoryCounts.get(label)
      categoryCounts.set(label, {
        count: (prev?.count ?? 0) + 1,
        color: prev?.color ?? category?.color ?? event.color,
      })
    })

    const total = rangeEvents.length
    if (total === 0) return []

    return Array.from(categoryCounts.entries())
      .filter(([, value]) => value.count > 0)
      .map(([category, value]) => ({
        category,
        count: value.count,
        percent: (value.count / total) * 100,
        color: value.color,
      }))
      .sort((a, b) => b.count - a.count)
  }, [categoryMeta, rangeEvents, resolveCategoryLabel])

  const categoryAvgDurationData = useMemo(() => {
    const categoryDuration = new Map<string, { total: number; count: number; color: string }>()
    rangeEvents.forEach((event) => {
      const duration = calculateDaySpanInHours(event.start, event.end)
      const category = categoryMeta.get(event.category)
      const label = resolveCategoryLabel(event.category)
      const prev = categoryDuration.get(label)
      categoryDuration.set(label, {
        total: (prev?.total ?? 0) + duration,
        count: (prev?.count ?? 0) + 1,
        color: prev?.color ?? category?.color ?? event.color,
      })
    })

    return Array.from(categoryDuration.entries())
      .map(([category, value]) => ({
        category,
        hours: Number((value.total / value.count).toFixed(1)),
        color: value.color,
      }))
      .sort((a, b) => b.hours - a.hours)
  }, [categoryMeta, rangeEvents, resolveCategoryLabel])

  const weekdayStacked = useMemo(() => {
    const buckets: Record<string, Record<string, { hours: number; color: string }>> = {}

    rangeEvents.forEach((event) => {
      const label = dayName(event.start)
      const categoryLabel = resolveCategoryLabel(event.category)
      const color = categoryMeta.get(event.category)?.color ?? event.color
      const hours = calculateDaySpanInHours(event.start, event.end)
      addDurationByDayCategory(buckets, label, categoryLabel, color, hours)
    })

    const categoryColors = new Map<string, string>()
    Object.values(buckets).forEach((value) => {
      Object.entries(value).forEach(([category, item]) => {
        if (!categoryColors.has(category)) {
          categoryColors.set(category, item.color)
        }
      })
    })

    const data = WEEKDAY_LABELS.map((label) => {
      const row: Record<string, string | number> = { day: label }
      const values = buckets[label] ?? {}
      categoryColors.forEach((_, category) => {
        row[category] = Number((values[category]?.hours ?? 0).toFixed(1))
      })
      return row
    })

    const series = Array.from(categoryColors.entries()).map(([key, color]) => ({
      key,
      color,
    }))

    return { data, series }
  }, [categoryMeta, rangeEvents, resolveCategoryLabel])

  const metrics = useMemo(() => {
    if (rangeEvents.length === 0) {
      return [
        { title: '最长连续有日程天数', value: '0 天', subtitle: '当前周期内暂无日程' },
        { title: '最忙的星期几', value: '暂无', subtitle: '当前周期内暂无日程' },
        { title: '日程平均提前安排天数', value: '0.0 天', subtitle: '数值越大代表规划越提前' },
        { title: '最集中的时间段', value: '暂无', subtitle: '当前周期内暂无日程' },
      ]
    }

    const days = generateRangeDays(dateRange)
    const activeSet = new Set(rangeEvents.map((event) => groupDayKey(event.start)))

    let bestStreak = 0
    let currentStreak = 0
    let bestStart = days[0]
    let bestEnd = days[0]
    let currentStart = days[0]

    days.forEach((day) => {
      const key = groupDayKey(day)
      if (activeSet.has(key)) {
        if (currentStreak === 0) currentStart = day
        currentStreak += 1
        if (currentStreak > bestStreak) {
          bestStreak = currentStreak
          bestStart = currentStart
          bestEnd = day
        }
      } else {
        currentStreak = 0
      }
    })

    const weekdayMap = new Map<string, number>()
    rangeEvents.forEach((event) => {
      const label = dayName(event.start)
      weekdayMap.set(label, (weekdayMap.get(label) ?? 0) + 1)
    })

    const totalWeeks = Math.max((differenceInCalendarDays(dateRange.end, dateRange.start) + 1) / 7, 1)
    const weekdayAverages = WEEKDAY_LABELS.map((label) => ({
      day: label,
      avg: (weekdayMap.get(label) ?? 0) / totalWeeks,
    }))

    const busiestDay = weekdayAverages.reduce((max, current) => (current.avg > max.avg ? current : max), weekdayAverages[0])
    const overallAvg = rangeEvents.length / 7
    const uplift = overallAvg === 0 ? 0 : ((busiestDay.avg - overallAvg) / overallAvg) * 100

    const leadTimes = rangeEvents.map((event) => (event.start.getTime() - event.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    const avgLead = leadTimes.reduce((sum, value) => sum + value, 0) / leadTimes.length

    const hourCounts = Array.from({ length: 24 }).map(() => 0)
    rangeEvents.forEach((event) => {
      hourCounts[event.start.getHours()] += 1
    })

    let bestWindowHour = 0
    let bestWindowCount = 0
    for (let i = 0; i < 24; i += 1) {
      const count = hourCounts[i] + hourCounts[(i + 1) % 24]
      if (count > bestWindowCount) {
        bestWindowCount = count
        bestWindowHour = i
      }
    }

    const concentrationRatio = rangeEvents.length === 0 ? 0 : (bestWindowCount / rangeEvents.length) * 100

    return [
      {
        title: '最长连续有日程天数',
        value: `${bestStreak} 天`,
        subtitle: `${format(bestStart, 'yyyy-MM-dd')} 至 ${format(bestEnd, 'yyyy-MM-dd')}`,
      },
      {
        title: '最忙的星期几',
        value: busiestDay.day,
        subtitle: `平均 ${busiestDay.avg.toFixed(1)} 个日程，高于整体 ${uplift.toFixed(1)}%`,
      },
      {
        title: '日程平均提前安排天数',
        value: `${avgLead.toFixed(1)} 天`,
        subtitle: '数值越大代表规划越提前',
      },
      {
        title: '最集中的时间段',
        value: formatHourRange(bestWindowHour),
        subtitle: `该时段占总日程 ${concentrationRatio.toFixed(1)}%`,
      },
    ]
  }, [dateRange, rangeEvents])

  return (
    <div className="space-y-6 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">日程分析</h2>
        <Select value={preset} onValueChange={(value) => setPreset(value as AnalyticsRangePreset)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">近 7 天</SelectItem>
            <SelectItem value="month">近 30 天</SelectItem>
            <SelectItem value="quarter">近 90 天</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <AnalyticsMetricsGrid items={metrics} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DailyMonthlyCountChart
          dailyData={countChart.dailyData}
          monthlyData={countChart.monthlyData}
          series={countChart.series}
          mode={countMode}
          onModeChange={setCountMode}
        />
        <CategoryDonutChart data={categoryDonutData} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CategoryAverageDurationChart data={categoryAvgDurationData} />
        <WeekdayStackedDurationChart data={weekdayStacked.data} series={weekdayStacked.series} />
      </div>

      <YearHeatmapChart data={heatmapData} />
    </div>
  )
}
