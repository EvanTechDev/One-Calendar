'use client'

import { useMemo, useState } from 'react'
import { getDay } from 'date-fns'
import type { CalendarEvent } from '../calendar'
import type { CalendarCategory } from '../sidebar/sidebar'
import {
  addDurationByDayCategory,
  calculateDaySpanInHours,
  filterEventsInRange,
  getChartColorOrderIndex,
  getMonthDays,
  groupDayKey,
  groupMonthKey,
  mapEventsToAnalyticsEvents,
  normalizeChartColor,
  resolveDateRange,
  type AnalyticsRangePreset,
} from '@/lib/analytics/utils'
import {
  compareSummaries,
  computeDistribution,
  computeInsights,
  computeSummary,
  previousRange,
  UNCATEGORIZED_ID,
  type AnalyticsEngineEvent,
} from '@/lib/analytics/engine'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@zntr/ui/select'
import { DailyMonthlyCountChart } from './charts/daily-monthly-count-chart'
import { YearHeatmapChart } from './charts/year-heatmap-chart'
import { CategoryDonutChart } from './charts/category-donut-chart'
import { CategoryAverageDurationChart } from './charts/category-average-duration-chart'
import { WeekdayStackedDurationChart } from './charts/weekday-stacked-duration-chart'
import { HourDistributionChart } from './charts/hour-distribution-chart'
import { AnalyticsTrendKpis } from './metrics/analytics-trend-kpis'
import { AnalyticsInsightsPanel } from './insights/analytics-insights-panel'
import { translations, useLanguage } from '@zntr/i18n/calendar'
import { cn } from '@zntr/utils'

interface TimeAnalyticsProps {
  events: CalendarEvent[]
  calendars?: CalendarCategory[]
  key?: string
  isSidebarTransitioning?: boolean
}

export default function TimeAnalyticsComponent({
  events,
  calendars = [],
  isSidebarTransitioning = false,
}: TimeAnalyticsProps) {
  const [language] = useLanguage()
  const t = translations[language]
  const weekdayLabels = [
    t.weekdays[1],
    t.weekdays[2],
    t.weekdays[3],
    t.weekdays[4],
    t.weekdays[5],
    t.weekdays[6],
    t.weekdays[0],
  ]
  const dayName = (date: Date): string => {
    const day = getDay(date)
    if (day === 0) return weekdayLabels[6]
    return weekdayLabels[day - 1]
  }
  const [preset, setPreset] = useState<AnalyticsRangePreset>('month')
  const [countMode, setCountMode] = useState<'day' | 'month'>('day')

  const now = useMemo(() => new Date(), [])
  const dateRange = useMemo(() => resolveDateRange(preset, now), [preset, now])

  const normalizedEvents = useMemo(
    () => mapEventsToAnalyticsEvents(events),
    [events],
  )
  const rangeEvents = useMemo(
    () => filterEventsInRange(normalizedEvents, dateRange),
    [normalizedEvents, dateRange],
  )

  // Engine-facing event list. Includes ALL events (both periods) so the
  // engine can compare the current range against the previous one.
  const engineEvents = useMemo<AnalyticsEngineEvent[]>(() => {
    return events
      .map((event) => {
        const raw = event as CalendarEvent & { createdAt?: string | Date }
        const createdAt = raw.createdAt ? new Date(raw.createdAt) : undefined
        return {
          id: event.id,
          start:
            event.startDate instanceof Date
              ? event.startDate
              : new Date(event.startDate),
          end:
            event.endDate instanceof Date
              ? event.endDate
              : new Date(event.endDate),
          categoryId: event.calendarId || null,
          isAllDay: event.isAllDay,
          createdAt:
            createdAt && !Number.isNaN(createdAt.getTime())
              ? createdAt
              : undefined,
        }
      })
      .filter(
        (event) =>
          !Number.isNaN(event.start.getTime()) &&
          !Number.isNaN(event.end.getTime()),
      )
  }, [events])

  const comparison = useMemo(() => {
    const current = computeSummary(engineEvents, dateRange)
    const previous = computeSummary(engineEvents, previousRange(dateRange))
    return compareSummaries(current, previous)
  }, [dateRange, engineEvents])

  const distribution = useMemo(
    () => computeDistribution(engineEvents, dateRange),
    [dateRange, engineEvents],
  )

  const insights = useMemo(
    () => computeInsights(engineEvents, dateRange),
    [dateRange, engineEvents],
  )

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

  const resolveCategoryColor = (
    categoryId: string,
    fallbackColor: string,
  ): string => {
    if (categoryId === 'uncategorized') return '#64748b'
    return categoryMeta.get(categoryId)?.color ?? fallbackColor
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
    if (normalized === '#6366f1') return t.colorIndigo
    if (normalized === '#fb923c') return t.colorOrange
    return color
  }

  const countChart = useMemo(() => {
    const seriesMeta = new Map<
      string,
      { label: string; color: string; totalCount: number }
    >()
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
      .sort((a, b) => {
        const colorOrder =
          getChartColorOrderIndex(a[1].color) -
          getChartColorOrderIndex(b[1].color)
        if (colorOrder !== 0) return colorOrder
        return b[1].totalCount - a[1].totalCount
      })
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
      const label = resolveCategoryLabel(event.category)
      const prev = categoryCounts.get(label)
      categoryCounts.set(label, {
        count: (prev?.count ?? 0) + 1,
        color: prev?.color ?? resolveCategoryColor(event.category, event.color),
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
    const categoryDuration = new Map<
      string,
      { total: number; count: number; color: string }
    >()
    rangeEvents.forEach((event) => {
      const duration = calculateDaySpanInHours(event.start, event.end)
      const label = resolveCategoryLabel(event.category)
      const prev = categoryDuration.get(label)
      categoryDuration.set(label, {
        total: (prev?.total ?? 0) + duration,
        count: (prev?.count ?? 0) + 1,
        color: prev?.color ?? resolveCategoryColor(event.category, event.color),
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
    const buckets: Record<
      string,
      Record<string, { hours: number; color: string }>
    > = {}

    rangeEvents.forEach((event) => {
      const label = dayName(event.start)
      const categoryLabel = resolveCategoryLabel(event.category)
      const color = resolveCategoryColor(event.category, event.color)
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

    const data = weekdayLabels.map((label) => {
      const row: { day: string; [category: string]: string | number } = {
        day: label,
      }
      const values = buckets[label] ?? {}
      categoryColors.forEach((_, category) => {
        row[category] = Number((values[category]?.hours ?? 0).toFixed(1))
      })
      return row
    })

    const series = Array.from(categoryColors.entries())
      .sort(
        (a, b) => getChartColorOrderIndex(a[1]) - getChartColorOrderIndex(b[1]),
      )
      .map(([key, color]) => ({
        key,
        color,
      }))

    return { data, series }
  }, [categoryMeta, rangeEvents, resolveCategoryLabel, weekdayLabels])

  return (
    <div className="space-y-6 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{t.analyticsOverviewTitle}</h2>
        <Select
          value={preset}
          onValueChange={(value) => setPreset(value as AnalyticsRangePreset)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">{t.analyticsPresetWeek}</SelectItem>
            <SelectItem value="month">{t.analyticsPresetMonth}</SelectItem>
            <SelectItem value="quarter">{t.analyticsPresetQuarter}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <AnalyticsTrendKpis comparison={comparison} />

      <AnalyticsInsightsPanel
        insights={insights}
        resolveCategoryLabel={(categoryId) =>
          categoryId === UNCATEGORIZED_ID
            ? t.uncategorized
            : resolveCategoryLabel(categoryId)
        }
      />

      <div className={cn('space-y-4', isSidebarTransitioning && 'hidden')}>
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
          <HourDistributionChart
            data={distribution.byHour}
            peakWindow={distribution.peakWindow}
          />
          <WeekdayStackedDurationChart
            data={weekdayStacked.data}
            series={weekdayStacked.series}
          />
        </div>

        <CategoryAverageDurationChart data={categoryAvgDurationData} />

        <YearHeatmapChart data={heatmapData} />
      </div>
    </div>
  )
}
