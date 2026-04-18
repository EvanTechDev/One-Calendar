'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

interface PeriodCompareDatum {
  day: string
  current: number
  previous: number
}

interface PeriodComparisonLineChartProps {
  data: PeriodCompareDatum[]
}

const chartConfig = {
  current: {
    label: '本期',
    color: 'hsl(var(--primary))',
  },
  previous: {
    label: '上一期',
    color: 'hsl(var(--chart-4))',
  },
} satisfies ChartConfig

export function PeriodComparisonLineChart({ data }: PeriodComparisonLineChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>同期日程对比</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">暂无数据</div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[320px] w-full">
            <LineChart data={data} margin={{ left: 8, right: 16, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line
                type="monotone"
                dataKey="current"
                stroke="var(--color-current)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="previous"
                stroke="var(--color-previous)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
