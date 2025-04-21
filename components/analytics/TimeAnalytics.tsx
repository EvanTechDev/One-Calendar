"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { analyzeTimeUsage, type TimeAnalytics } from "@/lib/time-analytics"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CalendarEvent } from "../Calendar"
import type { CalendarCategory } from "../Sidebar"
import { translations, useLanguage } from "@/lib/i18n"

interface TimeAnalyticsProps {
  events: CalendarEvent[]
  calendars?: CalendarCategory[]
}

export default function TimeAnalyticsComponent({ events, calendars = [] }: TimeAnalyticsProps) {
  // 使用相同的存储键"calendar-categories"
  const [timeCategories, setTimeCategories] = useLocalStorage<CalendarCategory[]>("calendar-categories", calendars)
  const [analytics, setAnalytics] = useState<TimeAnalytics | null>(null)
  const [newCategory, setNewCategory] = useState<Partial<CalendarCategory>>({
    name: "",
    color: "bg-gray-500",
    keywords: [],
  })
  const [timeRange, setTimeRange] = useState<"week" | "month" | "year">("month")
  const [language] = useLanguage()
  const t = translations[language]
  // 添加一个状态来强制组件重新渲染
  const [forceUpdate, setForceUpdate] = useState(0)

  // 监听语言变化事件
  useEffect(() => {
    const handleLanguageChange = () => {
      // 强制组件重新渲染
      setForceUpdate((prev) => prev + 1)
    }

    window.addEventListener("languagechange", handleLanguageChange)
    return () => {
      window.removeEventListener("languagechange", handleLanguageChange)
    }
  }, [])

  useEffect(() => {
    // 根据选择的时间范围过滤事件
    const now = new Date()
    const filteredEvents = events.filter((event) => {
      const eventDate = new Date(event.startDate)
      if (timeRange === "week") {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        return eventDate >= oneWeekAgo
      } else if (timeRange === "month") {
        const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
        return eventDate >= oneMonthAgo
      } else if (timeRange === "year") {
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
        return eventDate >= oneYearAgo
      }
      return true
    })

    const result = analyzeTimeUsage(filteredEvents, timeCategories)
    setAnalytics(result)
  }, [events, timeCategories, timeRange, language, forceUpdate]) // 添加language依赖，确保语言变化时重新渲染

  const handleAddCategory = () => {
    if (newCategory.name) {
      const newCat: CalendarCategory = {
        id: Date.now().toString(),
        name: newCategory.name,
        color: newCategory.color || "bg-gray-500",
        keywords: [], // 默认为空数组
      }
      setTimeCategories([...timeCategories, newCat])
      setNewCategory({
        name: "",
        color: "bg-gray-500",
        keywords: [],
      })
    }
  }

  const handleRemoveCategory = (id: string) => {
    setTimeCategories(timeCategories.filter((cat) => cat.id !== id))
  }

  if (!analytics) {
    return <div>{t.loading}</div>
  }

  // 为饼图准备数据
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

  // 为柱状图准备数据
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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{t.timeAnalytics}</CardTitle>
        <CardDescription>{t.timeAnalyticsDesc || "Analyze how you spend your time"}</CardDescription>
        <div className="flex justify-end">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                {t.manageCategories}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t.manageCategories}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category-name">{t.categoryName}</Label>
                  <Input
                    id="category-name"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.color}</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "blue-500",
                      "green-500",
                      "purple-500",
                      "yellow-500",
                      "red-500",
                      "pink-500",
                      "indigo-500",
                      "orange-500",
                      "teal-500",
                    ].map((color) => (
                      <div
                        key={color}
                        className={cn(
                          `bg-${color} w-6 h-6 rounded-full cursor-pointer`,
                          newCategory.color === `bg-${color}` ? "ring-2 ring-offset-2 ring-black" : "",
                        )}
                        onClick={() => setNewCategory({ ...newCategory, color: `bg-${color}` })}
                      />
                    ))}
                  </div>
                </div>
                <Button onClick={handleAddCategory} disabled={!newCategory.name}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t.addCategory}
                </Button>
                <div className="space-y-2 mt-4">
                  <Label>{t.existingCategories}</Label>
                  <div className="space-y-2">
                    {timeCategories.map((category) => (
                      <div key={category.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <div className="flex items-center">
                          <div className={cn("w-4 h-4 rounded-full mr-2", category.color)} />
                          <span>{category.name}</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveCategory(category.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
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
                    labelLine={true}
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
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="text-lg font-medium">{t.totalEvents}</h3>
                <p className="text-3xl font-bold mt-2">{analytics.totalEvents}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="text-lg font-medium">{t.mostProductiveDay}</h3>
                <p className="text-3xl font-bold mt-2">
                  {analytics.mostProductiveDay ? new Date(analytics.mostProductiveDay).toLocaleDateString() : t.noData}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="text-lg font-medium">{t.mostProductiveHour}</h3>
                <p className="text-3xl font-bold mt-2">
                  {analytics.mostProductiveHour !== undefined ? `${analytics.mostProductiveHour}:00` : t.noData}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  )
}

