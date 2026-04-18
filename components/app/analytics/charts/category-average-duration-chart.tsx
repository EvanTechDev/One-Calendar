'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DurationDatum {
  category: string
  hours: number
}

interface CategoryAverageDurationChartProps {
  data: DurationDatum[]
}

export function CategoryAverageDurationChart({ data }: CategoryAverageDurationChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>各分类平均时长（小时）</CardTitle>
      </CardHeader>
      <CardContent className="h-[320px]">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">暂无数据</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" unit="h" />
              <YAxis type="category" dataKey="category" width={96} />
              <Tooltip formatter={(value: number) => [`${value.toFixed(1)} 小时`, '平均时长']} />
              <Bar dataKey="hours" fill="hsl(var(--chart-2))" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
