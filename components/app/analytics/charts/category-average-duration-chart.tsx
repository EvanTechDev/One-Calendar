'use client'

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { translations, useLanguage } from '@/lib/i18n'

interface DurationDatum {
  category: string
  hours: number
  color: string
}

interface CategoryAverageDurationChartProps {
  data: DurationDatum[]
}

export function CategoryAverageDurationChart({
  data,
}: CategoryAverageDurationChartProps) {
  const [language] = useLanguage()
  const t = translations[language]
  const chartConfig = {
    hours: {
      label: t.analyticsAverageDuration,
      color: 'var(--chart-2)',
    },
  } satisfies ChartConfig

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.analyticsCategoryAverageDurationTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
            {t.noData}
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[320px] w-full">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ left: 8, right: 16, top: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" unit="h" />
              <YAxis type="category" dataKey="category" width={96} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => `${value} ${t.analyticsHourUnit}`}
                  />
                }
              />
              <Bar dataKey="hours" radius={[0, 8, 8, 0]}>
                {data.map((entry) => (
                  <Cell key={entry.category} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
