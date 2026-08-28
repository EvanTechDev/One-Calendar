'use client'

import {
  AlertTriangle,
  CalendarCheck,
  Flame,
  Lightbulb,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@zntr/ui/card'
import { cn } from '@zntr/utils'
import { translations, useLanguage } from '@zntr/i18n/calendar'
import type { AnalyticsInsight, InsightSeverity } from '@/lib/analytics/engine'

interface AnalyticsInsightsPanelProps {
  insights: AnalyticsInsight[]
  resolveCategoryLabel: (categoryId: string) => string
}

const fill = (
  template: string,
  values: Record<string, string | number>,
): string =>
  Object.entries(values).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template,
  )

const formatHour = (hour: number): string =>
  `${String(hour).padStart(2, '0')}:00`

function severityClasses(severity: InsightSeverity): string {
  if (severity === 'warning') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
  }
  if (severity === 'positive') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
  }
  return 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'
}

export function AnalyticsInsightsPanel({
  insights,
  resolveCategoryLabel,
}: AnalyticsInsightsPanelProps) {
  const [language] = useLanguage()
  const t = translations[language]

  const weekdayName = (weekday: number): string => {
    // Engine weekdays are Monday-first; t.weekdays is Sunday-first.
    return t.weekdays[(weekday + 1) % 7]
  }

  const render = (
    insight: AnalyticsInsight,
  ): { icon: typeof Lightbulb; text: string } => {
    switch (insight.type) {
      case 'volume_trend': {
        const up = insight.data.changePct > 0
        return {
          icon: up ? TrendingUp : TrendingDown,
          text: fill(
            up ? t.analyticsInsightVolumeUp : t.analyticsInsightVolumeDown,
            {
              pct: Math.abs(insight.data.changePct).toFixed(0),
              current: insight.data.currentCount,
              previous: insight.data.previousCount,
            },
          ),
        }
      }
      case 'busiest_weekday':
        return {
          icon: Flame,
          text: fill(t.analyticsInsightBusiestWeekday, {
            weekday: weekdayName(insight.data.weekday),
            pct: insight.data.sharePct.toFixed(0),
          }),
        }
      case 'overloaded_days':
        return {
          icon: AlertTriangle,
          text: fill(t.analyticsInsightOverloadedDays, {
            days: insight.data.days,
            threshold: insight.data.thresholdHours,
            max: insight.data.maxHours.toFixed(1),
          }),
        }
      case 'long_streak':
        return {
          icon: Flame,
          text: fill(t.analyticsInsightLongStreak, {
            days: insight.data.days,
            start: insight.data.startDate,
            end: insight.data.endDate,
          }),
        }
      case 'no_free_days':
        return {
          icon: AlertTriangle,
          text: fill(t.analyticsInsightNoFreeDays, {
            days: insight.data.days,
          }),
        }
      case 'fragmented':
        return {
          icon: AlertTriangle,
          text: fill(t.analyticsInsightFragmented, {
            pct: insight.data.shortPct.toFixed(0),
            minutes: insight.data.thresholdMinutes,
          }),
        }
      case 'category_shift': {
        const up = insight.data.toPct > insight.data.fromPct
        return {
          icon: up ? TrendingUp : TrendingDown,
          text: fill(t.analyticsInsightCategoryShift, {
            category: resolveCategoryLabel(insight.data.categoryId),
            from: insight.data.fromPct.toFixed(0),
            to: insight.data.toPct.toFixed(0),
          }),
        }
      }
      case 'peak_hours':
        return {
          icon: Sparkles,
          text: fill(t.analyticsInsightPeakHours, {
            start: formatHour(insight.data.startHour),
            end: formatHour(insight.data.endHour),
            pct: insight.data.sharePct.toFixed(0),
          }),
        }
      case 'free_weekday':
        return {
          icon: CalendarCheck,
          text: fill(t.analyticsInsightFreeWeekday, {
            weekday: weekdayName(insight.data.weekday),
          }),
        }
      case 'planning_ahead':
        return {
          icon: CalendarCheck,
          text: fill(t.analyticsInsightPlanningAhead, {
            days: insight.data.avgLeadDays.toFixed(1),
          }),
        }
      case 'spontaneous':
        return {
          icon: Sparkles,
          text: fill(t.analyticsInsightSpontaneous, {
            days: insight.data.avgLeadDays.toFixed(1),
          }),
        }
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4" />
          {t.analyticsInsightsTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t.analyticsInsightsEmpty}
          </p>
        ) : (
          <ul className="space-y-2">
            {insights.map((insight, index) => {
              const { icon: Icon, text } = render(insight)
              return (
                <li
                  key={`${insight.type}-${index}`}
                  className={cn(
                    'flex items-start gap-2 rounded-md border px-3 py-2',
                    severityClasses(insight.severity),
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="text-sm text-foreground">{text}</span>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
