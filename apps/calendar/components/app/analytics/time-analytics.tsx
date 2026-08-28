'use client'

import { useMemo, useState, type ReactNode } from 'react'
import type { CalendarEvent } from '../calendar'
import type { CalendarCategory } from '../sidebar/sidebar'
import {
  mapEventsToAnalyticsEvents,
  filterEventsInRange,
  normalizeChartColor,
  resolveDateRange,
  calculateDaySpanInHours,
  type AnalyticsRangePreset,
} from '@/lib/analytics/utils'
import {
  compareSummaries,
  computeDistribution,
  computeInsights,
  computeSummary,
  dayKeyOf,
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
import { Card, CardContent, CardHeader, CardTitle } from '@zntr/ui/card'
import { YearHeatmapChart } from './charts/year-heatmap-chart'
import { WeekPunchCard } from './charts/week-punch-card'
import {
  CategoryLedger,
  type CategoryLedgerRow,
} from './charts/category-ledger'
import { AnalyticsHero, type RhythmDay } from './metrics/analytics-hero'
import { AnalyticsInsightsPanel } from './insights/analytics-insights-panel'
import { translations, useLanguage } from '@zntr/i18n/calendar'
import { cn } from '@zntr/utils'

interface TimeAnalyticsProps {
  events: CalendarEvent[]
  calendars?: CalendarCategory[]
  key?: string
  isSidebarTransitioning?: boolean
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export default function TimeAnalyticsComponent({
  events,
  calendars = [],
  isSidebarTransitioning = false,
}: TimeAnalyticsProps) {
  const [language] = useLanguage()
  const t = translations[language]
  const [preset, setPreset] = useState<AnalyticsRangePreset>('month')

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

  // One thin bar per day of the range for the hero rhythm strip.
  const rhythm = useMemo<RhythmDay[]>(() => {
    const counts = new Map<string, number>()
    for (const event of engineEvents) {
      if (event.start < dateRange.start || event.start > dateRange.end) {
        continue
      }
      const key = dayKeyOf(event.start)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const days: RhythmDay[] = []
    for (
      let cursor = dateRange.start.getTime();
      cursor <= dateRange.end.getTime();
      cursor += 86_400_000
    ) {
      const key = dayKeyOf(new Date(cursor))
      days.push({ key, count: counts.get(key) ?? 0 })
    }
    return days
  }, [dateRange, engineEvents])

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
    if (categoryId === UNCATEGORIZED_ID) return t.uncategorized
    return categoryMeta.get(categoryId)?.name ?? categoryId
  }

  const categoryLedger = useMemo<CategoryLedgerRow[]>(() => {
    const buckets = new Map<
      string,
      { count: number; totalHours: number; color: string }
    >()
    rangeEvents.forEach((event) => {
      const bucket = buckets.get(event.category) ?? {
        count: 0,
        totalHours: 0,
        color:
          event.category === UNCATEGORIZED_ID
            ? '#64748b'
            : (categoryMeta.get(event.category)?.color ?? event.color),
      }
      bucket.count += 1
      bucket.totalHours += Math.min(
        calculateDaySpanInHours(event.start, event.end),
        24,
      )
      buckets.set(event.category, bucket)
    })
    const total = rangeEvents.length
    if (total === 0) return []
    return Array.from(buckets.entries())
      .map(([categoryId, bucket]) => ({
        category: resolveCategoryLabel(categoryId),
        color: bucket.color,
        count: bucket.count,
        percent: (bucket.count / total) * 100,
        avgHours: bucket.totalHours / bucket.count,
      }))
      .sort((a, b) => b.count - a.count)
  }, [categoryMeta, rangeEvents, t])

  const heatmapData = useMemo(() => {
    const currentYear = now.getFullYear()
    const counts = new Map<string, number>()
    normalizedEvents.forEach((event) => {
      if (event.start.getFullYear() !== currentYear) return
      const key = dayKeyOf(event.start)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    const days: { date: Date; count: number }[] = []
    for (
      let cursor = new Date(currentYear, 0, 1);
      cursor.getFullYear() === currentYear;
      cursor = new Date(cursor.getTime() + 86_400_000)
    ) {
      days.push({
        date: cursor,
        count: counts.get(dayKeyOf(cursor)) ?? 0,
      })
    }
    return days
  }, [normalizedEvents, now])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-muted-foreground tabular-nums max-md:min-w-0 max-md:truncate">
          {dayKeyOf(dateRange.start)} {t.analyticsTo} {dayKeyOf(dateRange.end)}
        </span>
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

      <Card>
        <CardContent>
          <AnalyticsHero comparison={comparison} rhythm={rhythm} />
        </CardContent>
      </Card>

      <Section title={t.analyticsInsightsTitle}>
        <AnalyticsInsightsPanel
          insights={insights}
          resolveCategoryLabel={resolveCategoryLabel}
        />
      </Section>

      <div className={cn('space-y-6', isSidebarTransitioning && 'hidden')}>
        <Section title={t.analyticsSectionWeek}>
          <WeekPunchCard distribution={distribution} />
        </Section>

        <Section title={t.analyticsSectionCategories}>
          <CategoryLedger data={categoryLedger} />
        </Section>

        <Section title={t.analyticsSectionYear}>
          <YearHeatmapChart data={heatmapData} />
        </Section>
      </div>
    </div>
  )
}
