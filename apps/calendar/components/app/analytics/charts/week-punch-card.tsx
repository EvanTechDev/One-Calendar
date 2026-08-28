'use client'

import { cn } from '@zntr/utils'
import { translations, useLanguage } from '@zntr/i18n/calendar'
import type { TimeDistribution } from '@/lib/analytics/engine'

interface WeekPunchCardProps {
  distribution: TimeDistribution
}

const HOUR_MARKS = [0, 6, 12, 18]

/**
 * The analytics view's signature: a 7x24 punch card of when the user's week
 * actually happens. Rows are weekdays, columns are start hours; each cell is
 * a dot whose size and opacity scale with event count. The right rail shows
 * per-weekday scheduled hours so the card answers both "when in the day" and
 * "which days are heavy" at once.
 */
export function WeekPunchCard({ distribution }: WeekPunchCardProps) {
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

  const maxCell = distribution.punchCard.reduce(
    (max, row) => row.reduce((m, count) => Math.max(m, count), max),
    0,
  )
  const maxHours = distribution.byWeekday.reduce(
    (max, day) => Math.max(max, day.hours),
    0,
  )
  const total = distribution.byHour.reduce((sum, item) => sum + item.count, 0)

  if (total === 0 && maxCell === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        {t.noData}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div
          className="grid items-center gap-y-1"
          style={{
            gridTemplateColumns: 'minmax(2rem,auto) repeat(24, 1fr) 5rem',
          }}
        >
          {weekdayLabels.map((label, weekday) => {
            const dayHours = distribution.byWeekday[weekday]?.hours ?? 0
            const isWeekend = weekday >= 5
            return (
              <div key={label} className="contents">
                <span
                  className={cn(
                    'pr-3 text-right text-xs tabular-nums',
                    isWeekend
                      ? 'text-muted-foreground/60'
                      : 'text-muted-foreground',
                  )}
                >
                  {label}
                </span>
                {Array.from({ length: 24 }, (_, hour) => {
                  const count = distribution.punchCard[weekday]?.[hour] ?? 0
                  const ratio = maxCell === 0 ? 0 : count / maxCell
                  return (
                    <div
                      key={hour}
                      className="flex h-7 items-center justify-center"
                      title={
                        count > 0
                          ? `${label} ${String(hour).padStart(2, '0')}:00 · ${count} ${t.analyticsCountUnit}`
                          : undefined
                      }
                    >
                      {count === 0 ? (
                        <span className="h-1 w-1 rounded-full bg-foreground/[0.07]" />
                      ) : (
                        <span
                          className="rounded-full bg-primary"
                          style={{
                            width: `${7 + ratio * 11}px`,
                            height: `${7 + ratio * 11}px`,
                            opacity: 0.35 + ratio * 0.65,
                          }}
                        />
                      )}
                    </div>
                  )
                })}
                <div className="flex items-center gap-1.5 pl-3">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/[0.07]">
                    <div
                      className="h-full rounded-full bg-primary/60"
                      style={{
                        width:
                          maxHours === 0
                            ? '0%'
                            : `${(dayHours / maxHours) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="w-8 text-right text-[10px] text-muted-foreground tabular-nums">
                    {dayHours.toFixed(0)}h
                  </span>
                </div>
              </div>
            )
          })}

          {/* Hour axis */}
          <span />
          {Array.from({ length: 24 }, (_, hour) => (
            <span
              key={hour}
              className="pt-1 text-center text-[10px] text-muted-foreground tabular-nums"
            >
              {HOUR_MARKS.includes(hour) ? String(hour).padStart(2, '0') : ''}
            </span>
          ))}
          <span />
        </div>
      </div>
    </div>
  )
}
