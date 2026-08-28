'use client'

import { translations, useLanguage } from '@zntr/i18n/calendar'

export interface CategoryLedgerRow {
  category: string
  color: string
  count: number
  percent: number
  avgHours: number
}

interface CategoryLedgerProps {
  data: CategoryLedgerRow[]
}

/**
 * Replaces the donut + average-duration bar pair: one proportional band
 * showing category share at a glance, then a ledger with the exact numbers
 * (count, share, average length) per category.
 */
export function CategoryLedger({ data }: CategoryLedgerProps) {
  const [language] = useLanguage()
  const t = translations[language]

  if (data.length === 0) {
    return (
      <div className="flex h-[160px] items-center justify-center text-sm text-muted-foreground">
        {t.noData}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex h-2.5 w-full gap-px overflow-hidden rounded-full">
        {data.map((row) => (
          <div
            key={row.category}
            title={`${row.category} · ${row.percent.toFixed(1)}%`}
            style={{
              width: `${row.percent}%`,
              backgroundColor: row.color,
            }}
          />
        ))}
      </div>

      <div>
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 border-b pb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          <span>{t.analyticsLedgerCategory}</span>
          <span className="w-12 text-right">{t.analyticsCountUnit}</span>
          <span className="w-12 text-right">%</span>
          <span className="w-16 text-right">{t.analyticsLedgerAvg}</span>
        </div>
        <div>
          {data.map((row) => (
            <div
              key={row.category}
              className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-6 border-b border-foreground/[0.05] py-2 text-sm last:border-b-0"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: row.color }}
                />
                <span className="truncate">{row.category}</span>
              </span>
              <span className="w-12 text-right tabular-nums">{row.count}</span>
              <span className="w-12 text-right text-muted-foreground tabular-nums">
                {row.percent.toFixed(0)}%
              </span>
              <span className="w-16 text-right text-muted-foreground tabular-nums">
                {row.avgHours >= 1
                  ? `${row.avgHours.toFixed(1)}h`
                  : `${Math.round(row.avgHours * 60)}m`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
