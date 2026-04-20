'use client'

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

interface DurationDatum {
  category: string
  hours: number
  color: string
}

interface CategoryAverageDurationChartProps {
  data: DurationDatum[]
}

const chartConfig = {
  hours: {
    label: '平均时长',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig

export function CategoryAverageDurationChart({
  data,
}: CategoryAverageDurationChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>各分类平均时长（小时）</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">暂无数据</div>
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
                content={<ChartTooltipContent formatter={(value) => `${value} 小时`} />}
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
