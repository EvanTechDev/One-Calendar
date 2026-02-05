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

const roundToSingleDecimal = (value: number) => Math.round(value * 10) / 10

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

  useEffect(() => {
    const now = new Date()
    const filteredEvents = events.filter((event) => {
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

    const result = analyzeTimeUsage(filteredEvents, timeCategories)
    setAnalytics(result)
  }, [events, timeCategories, timeRange, language, forceUpdate])

  const pieData = useMemo(
    () =>
      analytics
        ? Object.entries(analytics.categorizedHours)
            .filter(([_, hours]) => hours > 0)
            .map(([categoryId, hours]) => {
              const category = timeCategories.find((cat) => cat.id === categoryId)
              return {
                name: category ? category.name : t.uncategorized,
                value: roundToSingleDecimal(hours),
                color: category ? category.color.replace("bg-", "") : "gray-500",
              }
            })
        : [],
    [analytics, timeCategories, t.uncategorized],
  )

  const barData = useMemo(
    () =>
      analytics
        ? Object.entries(analytics.categorizedHours)
            .filter(([_, hours]) => hours > 0)
            .map(([categoryId, hours]) => {
              const category = timeCategories.find((cat) => cat.id === categoryId)
              return {
                name: category ? category.name : t.uncategorized,
                hours: roundToSingleDecimal(hours),
                color: category ? category.color.replace("bg-", "") : "gray-500",
              }
            })
        : [],
    [analytics, timeCategories, t.uncategorized],
  )

  const insights = useMemo(() => {
    if (!analytics) {
      return {
        averageHoursPerEvent: 0,
        busiestCategoryName: t.noData,
        busiestCategoryHours: 0,
      }
    }

    const averageHoursPerEvent = analytics.totalEvents > 0 ? analytics.totalHours / analytics.totalEvents : 0
    const sortedByHours = [...barData].sort((a, b) => b.hours - a.hours)
    const busiestCategory = sortedByHours[0]

    return {
      averageHoursPerEvent: roundToSingleDecimal(averageHoursPerEvent),
      busiestCategoryName: busiestCategory?.name || t.noData,
      busiestCategoryHours: busiestCategory?.hours || 0,
    }
  }, [analytics, barData, t.noData])

  if (!analytics) {
    return <div>{t.loading}</div>
  }

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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{t.timeAnalytics}</CardTitle>
        <CardDescription>{t.timeAnalyticsDesc || "Analyze how you spend your time"}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTimeRange("week")}
            className={`rounded-md border px-3 py-1 text-sm ${timeRange === "week" ? "bg-primary text-primary-foreground" : "bg-background"}`}
          >
            {t.thisWeek}
          </button>
          <button
            type="button"
            onClick={() => setTimeRange("month")}
            className={`rounded-md border px-3 py-1 text-sm ${timeRange === "month" ? "bg-primary text-primary-foreground" : "bg-background"}`}
          >
            {t.thisMonth}
          </button>
          <button
            type="button"
            onClick={() => setTimeRange("year")}
            className={`rounded-md border px-3 py-1 text-sm ${timeRange === "year" ? "bg-primary text-primary-foreground" : "bg-background"}`}
          >
            {t.thisYear}
          </button>
        </div>

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
                  <YAxis dataKey="name" type="category" width={80} />
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <h3 className="text-lg font-medium">{t.totalEvents}</h3>
              <p className="text-3xl font-bold mt-2">{analytics.totalEvents}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <h3 className="text-lg font-medium">{t.totalHours}</h3>
              <p className="text-3xl font-bold mt-2">{roundToSingleDecimal(analytics.totalHours)}h</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <h3 className="text-lg font-medium">{t.averageEventDuration}</h3>
              <p className="text-3xl font-bold mt-2">{insights.averageHoursPerEvent}h</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <h3 className="text-lg font-medium">{t.mostProductiveDay}</h3>
              <p className="text-xl font-bold mt-2">
                {analytics.mostProductiveDay ? new Date(analytics.mostProductiveDay).toLocaleDateString() : t.noData}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <h3 className="text-lg font-medium">{t.mostProductiveHour}</h3>
              <p className="text-3xl font-bold mt-2">
                {analytics.mostProductiveHour !== undefined ? `${analytics.mostProductiveHour}:00` : t.noData}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <h3 className="text-lg font-medium">{t.focusCategory}</h3>
              <p className="text-lg font-bold mt-2">{insights.busiestCategoryName}</p>
              <p className="text-sm text-muted-foreground mt-1">{insights.busiestCategoryHours}h</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4 border-dashed">
          <CardContent className="pt-6">
            <h4 className="font-semibold">{t.longestEvent}</h4>
            <p className="mt-2 text-sm text-muted-foreground">
              {analytics.longestEvent.duration > 0
                ? `${analytics.longestEvent.title || t.unnamedEvent} · ${roundToSingleDecimal(analytics.longestEvent.duration)}h`
                : t.noData}
            </p>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  )
}
