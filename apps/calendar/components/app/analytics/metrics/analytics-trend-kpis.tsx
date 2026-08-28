'use client'

import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Card, CardContent } from '@zntr/ui/card'
import { cn } from '@zntr/utils'
import { translations, useLanguage } from '@zntr/i18n/calendar'
import type { AnalyticsComparison, MetricDelta } from '@/lib/analytics/engine'

interface AnalyticsTrendKpisProps {
  comparison: AnalyticsComparison
}

interface KpiSpec {
  title: string
  delta: MetricDelta
  format: (value: number) => string
  /** Whether an increase should read as positive (green). */
  increaseIsGood: boolean
}

function TrendBadge({
  delta,
  increaseIsGood,
  vsLabel,
}: {
  delta: MetricDelta
  increaseIsGood: boolean
  vsLabel: string
}) {
  if (delta.changePct === null || delta.changePct === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        {vsLabel}
      </span>
    )
  }
  const up = delta.changePct > 0
  const good = up === increaseIsGood
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium',
        good
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-amber-600 dark:text-amber-400',
      )}
    >
      {up ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      {Math.abs(delta.changePct).toFixed(1)}%
      <span className="font-normal text-muted-foreground">{vsLabel}</span>
    </span>
  )
}

export function AnalyticsTrendKpis({ comparison }: AnalyticsTrendKpisProps) {
  const [language] = useLanguage()
  const t = translations[language]

  const formatHours = (value: number): string =>
    `${value.toFixed(1)} ${t.analyticsHourUnit}`

  const kpis: KpiSpec[] = [
    {
      title: t.analyticsKpiTotalEvents,
      delta: comparison.totalEvents,
      format: (value) => `${value}`,
      increaseIsGood: true,
    },
    {
      title: t.analyticsKpiScheduledHours,
      delta: comparison.scheduledHours,
      format: formatHours,
      increaseIsGood: true,
    },
    {
      title: t.analyticsKpiBusyDays,
      delta: comparison.busyDays,
      format: (value) => `${value} ${t.analyticsDayUnit}`,
      increaseIsGood: true,
    },
    {
      title: t.analyticsKpiAvgDuration,
      delta: comparison.avgDurationMinutes,
      format: (value) => `${Math.round(value)} ${t.analyticsMinuteUnit}`,
      increaseIsGood: false,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.title}>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs text-muted-foreground">{kpi.title}</p>
            <p className="text-2xl font-semibold tabular-nums">
              {kpi.format(kpi.delta.current)}
            </p>
            <TrendBadge
              delta={kpi.delta}
              increaseIsGood={kpi.increaseIsGood}
              vsLabel={t.analyticsVsPreviousPeriod}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
