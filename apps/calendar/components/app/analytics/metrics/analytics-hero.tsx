'use client'

import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@zntr/utils'
import { translations, useLanguage } from '@zntr/i18n/calendar'
import type { AnalyticsComparison, MetricDelta } from '@/lib/analytics/engine'

export interface RhythmDay {
  key: string
  count: number
}

interface AnalyticsHeroProps {
  comparison: AnalyticsComparison
  rhythm: RhythmDay[]
}

function Delta({
  delta,
  increaseIsGood,
}: {
  delta: MetricDelta
  increaseIsGood: boolean
}) {
  if (delta.changePct === null || delta.changePct === 0) return null
  const up = delta.changePct > 0
  const good = up === increaseIsGood
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
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
      {Math.abs(delta.changePct).toFixed(0)}%
    </span>
  )
}

function HeroStat({
  value,
  unit,
  label,
  delta,
  increaseIsGood,
}: {
  value: string
  unit?: string
  label: string
  delta: MetricDelta
  increaseIsGood: boolean
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-1.5">
        <span className="font-heading text-3xl font-semibold tracking-tight tabular-nums md:text-4xl">
          {value}
        </span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Delta delta={delta} increaseIsGood={increaseIsGood} />
      </div>
    </div>
  )
}

/**
 * The period's heartbeat: one thin bar per day. Quiet by design — it reads
 * as a texture first and a chart on hover.
 */
function RhythmStrip({ rhythm }: { rhythm: RhythmDay[] }) {
  const [language] = useLanguage()
  const t = translations[language]
  const max = rhythm.reduce((acc, day) => Math.max(acc, day.count), 0)

  if (rhythm.length === 0) return null

  return (
    <div>
      <div className="flex h-14 items-end gap-px sm:gap-0.5">
        {rhythm.map((day) => {
          const ratio = max === 0 ? 0 : day.count / max
          return (
            <div
              key={day.key}
              className="group relative flex h-full flex-1 items-end"
              title={`${day.key} · ${day.count} ${t.analyticsCountUnit}`}
            >
              <div
                className={cn(
                  'w-full rounded-[2px] transition-colors',
                  day.count === 0
                    ? 'bg-foreground/10 group-hover:bg-foreground/20'
                    : 'bg-primary group-hover:bg-primary/70',
                )}
                style={{
                  height: day.count === 0 ? '3px' : `${18 + ratio * 82}%`,
                  opacity: day.count === 0 ? 1 : 0.45 + ratio * 0.55,
                }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{rhythm[0].key}</span>
        <span>{rhythm[rhythm.length - 1].key}</span>
      </div>
    </div>
  )
}

export function AnalyticsHero({ comparison, rhythm }: AnalyticsHeroProps) {
  const [language] = useLanguage()
  const t = translations[language]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
        <HeroStat
          value={`${comparison.totalEvents.current}`}
          label={t.analyticsKpiTotalEvents}
          delta={comparison.totalEvents}
          increaseIsGood
        />
        <HeroStat
          value={comparison.scheduledHours.current.toFixed(1)}
          unit={t.analyticsHourUnit}
          label={t.analyticsKpiScheduledHours}
          delta={comparison.scheduledHours}
          increaseIsGood
        />
        <HeroStat
          value={`${comparison.busyDays.current}`}
          unit={t.analyticsDayUnit}
          label={t.analyticsKpiBusyDays}
          delta={comparison.busyDays}
          increaseIsGood
        />
        <HeroStat
          value={`${Math.round(comparison.avgDurationMinutes.current)}`}
          unit={t.analyticsMinuteUnit}
          label={t.analyticsKpiAvgDuration}
          delta={comparison.avgDurationMinutes}
          increaseIsGood={false}
        />
      </div>

      <RhythmStrip rhythm={rhythm} />
    </div>
  )
}
