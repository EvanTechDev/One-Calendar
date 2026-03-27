"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { analyzeTimeUsage, type TimeAnalytics } from "@/lib/time-analytics";
import type { CalendarCategory } from "../sidebar/sidebar";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { translations, useLanguage } from "@/lib/i18n";
import type { CalendarEvent } from "../calendar";
import { useState, useEffect } from "react";

interface TimeAnalyticsProps {
  events: CalendarEvent[];
  calendars?: CalendarCategory[];
}

export default function TimeAnalyticsComponent({
  events,
  calendars = [],
}: TimeAnalyticsProps) {
  const [timeCategories, setTimeCategories] = useLocalStorage<
    CalendarCategory[]
  >("calendar-categories", calendars);
  const [analytics, setAnalytics] = useState<TimeAnalytics | null>(null);
  const [newCategory, setNewCategory] = useState<Partial<CalendarCategory>>({
    name: "",
    color: "bg-gray-500",
    keywords: [],
  });
  const [timeRange, setTimeRange] = useState<"week" | "month" | "year">(
    "month",
  );
  const [language] = useLanguage();
  const t = translations[language];

  const [forceUpdate, setForceUpdate] = useState(0);

  useEffect(() => {
    const handleLanguageChange = () => {
      setForceUpdate((prev) => prev + 1);
    };

    window.addEventListener("languagechange", handleLanguageChange);
    return () => {
      window.removeEventListener("languagechange", handleLanguageChange);
    };
  }, []);

  useEffect(() => {
    const now = new Date();
    const filteredEvents = events.filter((event) => {
      const eventDate = new Date(event.startDate);
      if (timeRange === "week") {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return eventDate >= oneWeekAgo;
      } else if (timeRange === "month") {
        const oneMonthAgo = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          now.getDate(),
        );
        return eventDate >= oneMonthAgo;
      } else if (timeRange === "year") {
        const oneYearAgo = new Date(
          now.getFullYear() - 1,
          now.getMonth(),
          now.getDate(),
        );
        return eventDate >= oneYearAgo;
      }
      return true;
    });

    const result = analyzeTimeUsage(filteredEvents, timeCategories);
    setAnalytics(result);
  }, [events, timeCategories, timeRange, language, forceUpdate]);

  const handleAddCategory = () => {
    if (newCategory.name) {
      const newCat: CalendarCategory = {
        id: Date.now().toString(),
        name: newCategory.name,
        color: newCategory.color || "bg-gray-500",
        keywords: [],
      };
      setTimeCategories([...timeCategories, newCat]);
      setNewCategory({
        name: "",
        color: "bg-gray-500",
        keywords: [],
      });
    }
  };

  const handleRemoveCategory = (id: string) => {
    setTimeCategories(timeCategories.filter((cat) => cat.id !== id));
  };

  if (!analytics) {
    return <div>{t.loading}</div>;
  }

  const pieData = Object.entries(analytics.categorizedHours)
    .filter(([_, hours]) => hours > 0)
    .map(([categoryId, hours]) => {
      const category = timeCategories.find((cat) => cat.id === categoryId);
      return {
        name: category ? category.name : t.uncategorized,
        value: Math.round(hours * 10) / 10,
        color: category ? category.color.replace("bg-", "") : "gray-500",
      };
    });

  const barData = Object.entries(analytics.categorizedHours)
    .filter(([_, hours]) => hours > 0)
    .map(([categoryId, hours]) => {
      const category = timeCategories.find((cat) => cat.id === categoryId);
      return {
        name: category ? category.name : t.uncategorized,
        hours: Math.round(hours * 10) / 10,
        color: category ? category.color.replace("bg-", "") : "gray-500",
      };
    });

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
  };

  const busiestCategoryName = (() => {
    if (analytics.busiestCategoryId === "uncategorized") return t.uncategorized;
    return (
      timeCategories.find((cat) => cat.id === analytics.busiestCategoryId)
        ?.name || t.uncategorized
    );
  })();

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>{t.timeAnalytics}</CardTitle>
            <CardDescription>
              {t.timeAnalyticsDesc || "Analyze how you spend your time"}
            </CardDescription>
          </div>
          <Select
            value={timeRange}
            onValueChange={(value: "week" | "month" | "year") =>
              setTimeRange(value)
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">{t.thisWeek || "This Week"}</SelectItem>
              <SelectItem value="month">
                {t.thisMonth || "This Month"}
              </SelectItem>
              <SelectItem value="year">{t.thisYear || "This Year"}</SelectItem>
            </SelectContent>
          </Select>
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
                      <Cell
                        key={`cell-${index}`}
                        fill={colorMap[entry.color] || "#6b7280"}
                      />
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
                <BarChart
                  data={barData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip formatter={(value) => [`${value} ${t.hours}`, ""]} />
                  <Legend />
                  <Bar dataKey="hours" name={t.hours}>
                    {barData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={colorMap[entry.color] || "#6b7280"}
                      />
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
                <p className="text-3xl font-bold mt-2">
                  {analytics.totalEvents}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="text-lg font-medium">{t.mostProductiveDay}</h3>
                <p className="text-3xl font-bold mt-2">
                  {analytics.mostProductiveDay
                    ? new Date(analytics.mostProductiveDay).toLocaleDateString()
                    : t.noData}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="text-lg font-medium">{t.mostProductiveHour}</h3>
                <p className="text-3xl font-bold mt-2">
                  {analytics.mostProductiveHour !== undefined
                    ? `${analytics.mostProductiveHour}:00`
                    : t.noData}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="text-lg font-medium">
                  {t.totalHours || "Total Hours"}
                </h3>
                <p className="text-3xl font-bold mt-2">
                  {analytics.totalHours.toFixed(1)}h
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="text-lg font-medium">
                  {t.averageEventDuration || "Average Event Duration"}
                </h3>
                <p className="text-3xl font-bold mt-2">
                  {analytics.averageEventDuration.toFixed(1)}h
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="text-lg font-medium">
                  {t.busiestCategory || "Busiest Category"}
                </h3>
                <p className="text-2xl font-bold mt-2">
                  {busiestCategoryName || t.noData}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t.activeDays || "Active Days"}: {analytics.activeDays}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
