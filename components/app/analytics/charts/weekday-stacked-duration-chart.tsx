'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

interface WeekdayStackDatum {
  day: string
  [category: string]: string | number
}

interface CategorySeries {
  key: string
  color: string
}

interface WeekdayStackedDurationChartProps {
  data: WeekdayStackDatum[]
  series: CategorySeries[]
}

export function WeekdayStackedDurationChart({
  data,
  series,
}: WeekdayStackedDurationChartProps) {
  const chartConfig = series.reduce<ChartConfig>((acc, item) => {
    acc[item.key] = {
      label: item.key,
      color: item.color,
    }
    return acc
  }, {})

  return (
    <Card>
      <CardHeader>
        <CardTitle>一周各天时间分布</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 || series.length === 0 ? (
          <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">暂无数据</div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[320px] w-full">
            <BarChart data={data} margin={{ left: 8, right: 16, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis unit="h" />
              <ChartTooltip
                content={
                  <ChartTooltipContent formatter={(value) => `${Number(value).toFixed(1)} 小时`} />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              {series.map((item) => (
                <Bar
                  key={item.key}
                  dataKey={item.key}
                  stackId="duration"
                  fill={item.color}
                />
              ))}
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
