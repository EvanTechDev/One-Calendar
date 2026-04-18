'use client'

import { Cell, Pie, PieChart } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

interface DonutDatum {
  category: string
  count: number
  percent: number
  color: string
}

interface CategoryDonutChartProps {
  data: DonutDatum[]
}

export function CategoryDonutChart({ data }: CategoryDonutChartProps) {
  const chartConfig = data.reduce<ChartConfig>((acc, item) => {
    acc[item.category] = {
      label: item.category,
      color: item.color,
    }
    return acc
  }, {})

  return (
    <Card>
      <CardHeader>
        <CardTitle>日程分类占比</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">暂无数据</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[280px_1fr]">
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="category"
                  innerRadius={70}
                  outerRadius={105}
                >
                  {data.map((entry) => (
                    <Cell key={entry.category} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip
                  content={<ChartTooltipContent formatter={(value) => `${value} 个`} />}
                />
              </PieChart>
            </ChartContainer>
            <div className="space-y-3">
              {data.map((item) => (
                <div key={item.category} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.category}</span>
                  </div>
                  <span className="font-medium">{item.percent.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
