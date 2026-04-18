'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'

interface CountDatum {
  label: string
  count: number
}

interface DailyMonthlyCountChartProps {
  dailyData: CountDatum[]
  monthlyData: CountDatum[]
  mode: 'day' | 'month'
  onModeChange: (mode: 'day' | 'month') => void
}

export function DailyMonthlyCountChart({
  dailyData,
  monthlyData,
  mode,
  onModeChange,
}: DailyMonthlyCountChartProps) {
  const activeData = mode === 'day' ? dailyData : monthlyData

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>每天/每月日程数量</CardTitle>
        <Tabs value={mode} onValueChange={(value) => onModeChange(value as 'day' | 'month')}>
          <TabsList>
            <TabsTrigger value="day">按天</TabsTrigger>
            <TabsTrigger value="month">按月</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="h-[320px]">
        {activeData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">暂无数据</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={activeData} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tickFormatter={(value: string) => (mode === 'day' ? format(new Date(value), 'MM-dd') : value)} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
