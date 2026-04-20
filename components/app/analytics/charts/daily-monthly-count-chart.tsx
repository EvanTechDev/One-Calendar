'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import { translations, useLanguage } from '@/lib/i18n'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

interface CountDatum {
  label: string
  [category: string]: string | number
}

interface CountSeries {
  key: string
  label: string
  color: string
}

interface DailyMonthlyCountChartProps {
  dailyData: CountDatum[]
  monthlyData: CountDatum[]
  series: CountSeries[]
  mode: 'day' | 'month'
  onModeChange: (mode: 'day' | 'month') => void
}

export function DailyMonthlyCountChart({
  dailyData,
  monthlyData,
  series,
  mode,
  onModeChange,
}: DailyMonthlyCountChartProps) {
  const [language] = useLanguage()
  const t = translations[language]
  const activeData = mode === 'day' ? dailyData : monthlyData
  const seriesLabelMap = new Map(series.map((item) => [item.key, item.label]))
  const chartConfig = series.reduce<ChartConfig>((acc, item) => {
    acc[item.key] = {
      label: item.label,
      color: item.color,
    }
    return acc
  }, {})

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>{t.analyticsDailyMonthlyCountTitle}</CardTitle>
        <Tabs value={mode} onValueChange={(value) => onModeChange(value as 'day' | 'month')}>
          <TabsList>
            <TabsTrigger value="day">{t.analyticsByDay}</TabsTrigger>
            <TabsTrigger value="month">{t.analyticsByMonth}</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {activeData.length === 0 || series.length === 0 ? (
          <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">{t.noData}</div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[320px] w-full">
            <BarChart data={activeData} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickFormatter={(value: string) =>
                  mode === 'day' ? format(new Date(value), 'MM-dd') : value
                }
              />
              <YAxis allowDecimals={false} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name, item) => (
                      <div className="flex w-full items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-[2px]"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-muted-foreground">
                            {seriesLabelMap.get(String(item.dataKey ?? '')) ?? name}
                          </span>
                        </div>
                        <span className="font-mono font-medium text-foreground tabular-nums">
                          {value} {t.analyticsCountUnit}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              {series.map((item, index) => (
                <Bar
                  key={item.key}
                  dataKey={item.key}
                  stackId="count"
                  fill={item.color}
                  radius={index === series.length - 1 ? [8, 8, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
