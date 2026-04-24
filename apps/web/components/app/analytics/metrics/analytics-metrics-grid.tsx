'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface MetricItem {
  title: string
  value: string
  subtitle: string
}

interface AnalyticsMetricsGridProps {
  items: MetricItem[]
}

export function AnalyticsMetricsGrid({ items }: AnalyticsMetricsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {items.map((item) => (
        <Card key={item.title}>
          <CardHeader className="pb-2">
            <CardDescription>{item.title}</CardDescription>
            <CardTitle className="text-2xl">{item.value}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{item.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
