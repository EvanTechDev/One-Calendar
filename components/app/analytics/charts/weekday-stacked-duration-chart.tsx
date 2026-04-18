'use client'

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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

export function WeekdayStackedDurationChart({ data, series }: WeekdayStackedDurationChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>一周各天时间分布</CardTitle>
      </CardHeader>
      <CardContent className="h-[320px]">
        {data.length === 0 || series.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">暂无数据</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: 8, right: 16, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis unit="h" />
              <Tooltip formatter={(value: number) => [`${value.toFixed(1)} 小时`, '总时长']} />
              <Legend />
              {series.map((item) => (
                <Bar key={item.key} dataKey={item.key} stackId="duration" fill={item.color} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
