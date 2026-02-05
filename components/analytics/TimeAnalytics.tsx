"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { analyzeTimeUsage, type TimeAnalytics } from "@/lib/time-analytics"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts"
import type { CalendarEvent } from "../Calendar"
import type { CalendarCategory } from "../Sidebar"
import { translations, useLanguage } from "@/lib/i18n"

interface TimeAnalyticsProps {
  events: CalendarEvent[]
  calendars?: CalendarCategory[]
}

export default function TimeAnalyticsComponent({ events, calendars = [] }: TimeAnalyticsProps) {
  const [timeCategories] = useLocalStorage<CalendarCategory[]>("calendar-categories", calendars)
  const [analytics, setAnalytics] = useState<TimeAnalytics | null>(null)
  const [timeRange, setTimeRange] = useState<"week" | "month" | "year">("month")
  const [language] = useLanguage()
  const t = translations[language]
  const [forceUpdate, setForceUpdate] = useState(0)

  useEffect(() => {
    const handleLanguageChange = () => {
      setForceUpdate((prev) => prev + 1)
    }

    window.addEventListener("languagechange", handleLanguageChange)
    return () => {
      window.removeEventListener("languagechange", handleLanguageChange)
    }
  }, [])

  const filteredEvents = useMemo(() => {
    const now = new Date()
    return events.filter((event) => {
      const eventDate = new Date(event.startDate)
      if (timeRange === "week") {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        return eventDate >= oneWeekAgo
      }
      if (timeRange === "month") {
        const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
        return eventDate >= oneMonthAgo
      }
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      return eventDate >= oneYearAgo
    })
  }, [events, timeRange])

  useEffect(() => {
    const result = analyzeTimeUsage(filteredEvents, timeCategories)
    setAnalytics(result)
  }, [filteredEvents, timeCategories, language, forceUpdate])

  if (!analytics) {
    return <div>{t.loading}</div>
  }

  const pieData = Object.entries(analytics.categorizedHours)
    .filter(([_, hours]) => hours > 0)
    .map(([categoryId, hours]) => {
      const category = timeCategories.find((cat) => cat.id === categoryId)
      return {
        name: category ? category.name : t.uncategorized,
        value: Math.round(hours * 10) / 10,
        color: category ? category.color.replace("bg-", "") : "gray-500",
      }
    })

  const barData = Object.entries(analytics.categorizedHours)
    .filter(([_, hours]) => hours > 0)
    .map(([categoryId, hours]) => {
      const category = timeCategories.find((cat) => cat.id === categoryId)
      return {
        name: category ? category.name : t.uncategorized,
        hours: Math.round(hours * 10) / 10,
        color: category ? category.color.replace("bg-", "") : "gray-500",
      }
    })

  const colorMap: Record<string, string> = {
    "blue-500": "#3b82f6",
    "green-500": "#22c55e",
    "purple-500": "#a855f7",
    "yellow-500": "#eab308",
    "red-500": "#ef4444",
    "gray-500": "#6b7280",
    "pink-500": "#ec4899",
    "indigo-500": "#6366f1",
    "orange-500": "#f97316",
    "teal-500": "#14b8a6",
  }

  const topCategory = barData.length > 0 ? [...barData].sort((a, b) => b.hours - a.hours)[0] : null
  const avgDuration = analytics.totalEvents > 0 ? analytics.totalHours / analytics.totalEvents : 0

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{t.timeAnalytics}</CardTitle>
            <CardDescription>{t.timeAnalyticsDesc || "Analyze how you spend your time"}</CardDescription>
          </div>
          <div className="inline-flex rounded-md border bg-background p-1">
            {(["week", "month", "year"] as const).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setTimeRange(range)}
                className={`rounded px-3 py-1 text-sm transition-colors ${
                  timeRange === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {range === "week" ? t.week : range === "month" ? t.month : t.year}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-lg font-medium mb-2">{t.timeDistribution}</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine
                    label={({ name, value }) => `${name}: ${value}h`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colorMap[entry.color] || "#6b7280"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} ${t.hours}`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-medium mb-2">{t.categoryTime}</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip formatter={(value) => [`${value} ${t.hours}`, ""]} />
                  <Legend />
                  <Bar dataKey="hours" name={t.hours}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colorMap[entry.color] || "#6b7280"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <h3 className="text-sm text-muted-foreground">{t.totalEvents}</h3>
              <p className="text-2xl font-bold mt-2">{analytics.totalEvents}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <h3 className="text-sm text-muted-foreground">{t.totalHours || "Total Hours"}</h3>
              <p className="text-2xl font-bold mt-2">{analytics.totalHours.toFixed(1)}h</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <h3 className="text-sm text-muted-foreground">{t.analyticsAverageDuration || "Average Duration"}</h3>
              <p className="text-2xl font-bold mt-2">{avgDuration.toFixed(1)}h</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <h3 className="text-sm text-muted-foreground">{t.analyticsTopCategory || "Top Category"}</h3>
              <p className="text-lg font-bold mt-2 truncate">{topCategory ? topCategory.name : t.noData}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <h3 className="text-sm text-muted-foreground">{t.mostProductiveDay}</h3>
              <p className="text-lg font-semibold mt-2">
                {analytics.mostProductiveDay ? new Date(analytics.mostProductiveDay).toLocaleDateString(language) : t.noData}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <h3 className="text-sm text-muted-foreground">{t.mostProductiveHour}</h3>
              <p className="text-lg font-semibold mt-2">
                {analytics.mostProductiveHour !== undefined ? `${analytics.mostProductiveHour}:00` : t.noData}
              </p>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  )
}
