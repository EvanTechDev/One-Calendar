'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@zntr/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@zntr/ui/chart'
import { translations, useLanguage } from '@zntr/i18n/calendar'

interface HourDistributionChartProps {
  data: { hour: number; count: number }[]
  peakWindow: { startHour: number; sharePct: number } | null
}

export function HourDistributionChart({
  data,
  peakWindow,
}: HourDistributionChartProps) {
  const [language] = useLanguage()
  const t = translations[language]
  const total = data.reduce((sum, item) => sum + item.count, 0)

  const chartConfig = {
    count: {
      label: t.analyticsCountUnit,
      color: 'var(--chart-1)',
    },
  } satisfies ChartConfig

  const chartData = data.map((item) => ({
    ...item,
    label: `${String(item.hour).padStart(2, '0')}:00`,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.analyticsHourDistributionTitle}</CardTitle>
        {peakWindow && total > 0 && (
          <p className="text-sm text-muted-foreground">
            {t.analyticsPeakWindowSubtitle.replace(
              '{pct}',
              peakWindow.sharePct.toFixed(1),
            )}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            {t.noData}
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <BarChart data={chartData} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" interval={2} />
              <YAxis allowDecimals={false} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => `${value} ${t.analyticsCountUnit}`}
                  />
                }
              />
              <Bar dataKey="count" fill="var(--chart-1)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
