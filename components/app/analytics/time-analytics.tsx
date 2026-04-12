"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  buildAnalyticsRange,
  generateScheduleAnalytics,
  type AnalyticsRangeOption,
  type DayPartKey,
} from "@/lib/time-analytics";
import type { CalendarCategory } from "../sidebar/sidebar";
import type { CalendarEvent } from "../calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { translations, useLanguage } from "@/lib/i18n";

interface TimeAnalyticsProps {
  events: CalendarEvent[];
  calendars?: CalendarCategory[];
}

const COLOR_POOL = [
  "#4f46e5",
  "#06b6d4",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#0ea5e9",
  "#84cc16",
  "#f97316",
];

const TW_CLASS_TO_HEX: Record<string, string> = {
  "bg-blue-500": "#3b82f6",
  "bg-green-500": "#10b981",
  "bg-yellow-500": "#f59e0b",
  "bg-red-500": "#ef4444",
  "bg-purple-500": "#8b5cf6",
  "bg-pink-500": "#ec4899",
  "bg-teal-500": "#14b8a6",
  "bg-gray-500": "#6b7280",
};

export default function TimeAnalyticsComponent({ events, calendars = [] }: TimeAnalyticsProps) {
  const [language] = useLanguage();
  const t = translations[language];

  const RANGE_OPTIONS: Array<{ key: AnalyticsRangeOption["key"]; label: string }> = [
    { key: "7d", label: t.analyticsRange7d },
    { key: "30d", label: t.analyticsRange30d },
    { key: "90d", label: t.analyticsRange90d },
    { key: "1y", label: t.analyticsRange1y },
  ];

  const weekdayNames = [
    t.analyticsWeekdayMon,
    t.analyticsWeekdayTue,
    t.analyticsWeekdayWed,
    t.analyticsWeekdayThu,
    t.analyticsWeekdayFri,
    t.analyticsWeekdaySat,
    t.analyticsWeekdaySun,
  ];

  const dayPartNames: Record<DayPartKey, string> = {
    allDay: t.analyticsDayPartAllDay,
    morning: t.analyticsDayPartMorning,
    afternoon: t.analyticsDayPartAfternoon,
    evening: t.analyticsDayPartEvening,
    lateNight: t.analyticsDayPartLateNight,
  };

  const [rangeKey, setRangeKey] = useState<AnalyticsRangeOption["key"]>("30d");
  const [granularity, setGranularity] = useState<"day" | "month">("day");
  const [compareMode, setCompareMode] = useState<"week" | "month">("week");

  const range = useMemo(
    () =>
      buildAnalyticsRange(rangeKey, {
        "7d": t.analyticsRange7d,
        "30d": t.analyticsRange30d,
        "90d": t.analyticsRange90d,
        "1y": t.analyticsRange1y,
      }),
    [rangeKey, t],
  );

  const analytics = useMemo(
    () =>
      generateScheduleAnalytics({
        events,
        categories: calendars,
        range,
        granularity,
        compareMode,
        labels: {
          uncategorized: t.uncategorized,
          currentWeek: t.thisWeek,
          previousWeek: t.analyticsPreviousWeek,
          currentMonth: t.thisMonth,
          previousMonth: t.analyticsPreviousMonth,
        },
      }),
    [events, calendars, range, granularity, compareMode, t],
  );

  const categoryColorMap = useMemo(() => {
    const map: Record<string, string> = { uncategorized: "#a1a1aa" };
    calendars.forEach((category, idx) => {
      map[category.id] = TW_CLASS_TO_HEX[category.color] ?? COLOR_POOL[idx % COLOR_POOL.length];
    });
    return map;
  }, [calendars]);

  const chartConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = { count: { label: t.analyticsEventCountLabel, color: "#3b82f6" } };
    analytics.categoryShare.forEach((category, idx) => {
      config[category.key] = {
        label: category.label,
        color: categoryColorMap[category.key] ?? COLOR_POOL[idx % COLOR_POOL.length],
      };
    });
    return config;
  }, [analytics.categoryShare, categoryColorMap, t.analyticsEventCountLabel]);

  const maxHeat = Math.max(...analytics.yearlyHeatmap.map((item) => item.count), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>{t.analyticsV2Title}</CardTitle>
          <div className="flex gap-2">
            <Select value={rangeKey} onValueChange={(value) => setRangeKey(value as AnalyticsRangeOption["key"])}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={granularity} onValueChange={(value) => setGranularity(value as "day" | "month")}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day">{t.analyticsGranularityDay}</SelectItem>
                <SelectItem value="month">{t.analyticsGranularityMonth}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={compareMode} onValueChange={(value) => setCompareMode(value as "week" | "month")}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="week">{t.analyticsCompareWeek}</SelectItem>
                <SelectItem value="month">{t.analyticsCompareMonth}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t.analyticsCardDailyMonthly}</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ChartContainer config={chartConfig}>
              <BarChart data={analytics.dailyOrMonthlyCounts}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={20} />
                <YAxis allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t.analyticsCardHeatmap}</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="grid grid-rows-7 grid-flow-col gap-1 min-w-max">
                {analytics.yearlyHeatmap.map((cell) => {
                  const intensity = maxHeat === 0 ? 0 : cell.count / maxHeat;
                  const bg = intensity === 0 ? "#e5e7eb" : `rgba(79,70,229,${0.2 + intensity * 0.75})`;
                  return (
                    <div
                      key={cell.date}
                      title={`${cell.date} · ${cell.count} ${t.analyticsItemsUnit}`}
                      className="h-3 w-3 rounded-[2px]"
                      style={{ backgroundColor: bg }}
                    />
                  );
                })}
              </div>
            </div>
            <div className="mt-3 flex justify-end items-center gap-2 text-xs text-muted-foreground">
              <span>{t.analyticsHeatmapLow}</span>
              {[0.2, 0.4, 0.6, 0.8, 1].map((v) => (
                <span key={v} className="h-3 w-3 rounded-[2px]" style={{ backgroundColor: `rgba(79,70,229,${v})` }} />
              ))}
              <span>{t.analyticsHeatmapHigh}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t.analyticsCardCategoryShare}</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ChartContainer config={chartConfig}>
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent formatter={(value: number | string) => `${value} ${t.analyticsItemsUnit}`} />} />
                <Pie
                  data={analytics.categoryShare}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={3}
                >
                  {analytics.categoryShare.map((item, idx) => (
                    <Cell key={item.key} fill={categoryColorMap[item.key] ?? COLOR_POOL[idx % COLOR_POOL.length]} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t.analyticsCardRadar}</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ChartContainer config={{ radar: { label: t.analyticsTimeRatioLabel, color: "#4f46e5" } }}>
              <RadarChart data={analytics.radarDistribution} outerRadius="70%">
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Radar dataKey="value" fill="var(--color-radar)" fillOpacity={0.35} stroke="var(--color-radar)" />
              </RadarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t.analyticsCardBusyIdle}</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium">{t.analyticsBusyTop5}</p>
              <div className="space-y-2">
                {analytics.busySlots.map((item) => (
                  <div key={`${item.weekday}-${item.part}`} className="flex items-center gap-2 text-sm">
                    <span className="w-24 shrink-0">{`${weekdayNames[item.weekday]}${dayPartNames[item.part]}`}</span>
                    <div className="h-2 flex-1 rounded bg-muted overflow-hidden">
                      <div className="h-full bg-red-500" style={{ width: `${Math.max(8, (item.count / Math.max(analytics.busySlots[0]?.count || 1, 1)) * 100)}%` }} />
                    </div>
                    <span>{item.count}{t.analyticsItemsUnit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">{t.analyticsIdleTop5}</p>
              <div className="space-y-2">
                {analytics.idleSlots.map((item) => (
                  <div key={`${item.weekday}-${item.part}`} className="flex items-center gap-2 text-sm">
                    <span className="w-24 shrink-0">{`${weekdayNames[item.weekday]}${dayPartNames[item.part]}`}</span>
                    <div className="h-2 flex-1 rounded bg-muted overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${Math.max(8, (item.count / Math.max(analytics.busySlots[0]?.count || 1, 1)) * 100)}%` }} />
                    </div>
                    <span>{item.count}{t.analyticsItemsUnit}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t.analyticsCardComparison}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-sm text-muted-foreground">{analytics.periodComparison.currentLabel}</p>
                <p className="text-3xl font-semibold">{analytics.periodComparison.currentCount}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-sm text-muted-foreground">{analytics.periodComparison.previousLabel}</p>
                <p className="text-3xl font-semibold">{analytics.periodComparison.previousCount}</p>
              </div>
            </div>
            <p className={cn("text-sm font-medium", analytics.periodComparison.delta >= 0 ? "text-emerald-600" : "text-red-500")}>
              {analytics.periodComparison.delta >= 0 ? t.analyticsTrendUp : t.analyticsTrendDown}
              {Math.abs(analytics.periodComparison.delta)} {t.analyticsItemsUnit}（{Math.abs(analytics.periodComparison.ratio)}%）
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t.analyticsCardAverageDuration}</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ChartContainer config={chartConfig}>
              <BarChart data={analytics.categoryAvgDuration} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="category" type="category" width={80} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value: number | string) => `${value} ${t.analyticsMinutesUnit}`} />} />
                <Bar dataKey="avgMinutes" fill="#8b5cf6" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t.analyticsCardWeeklyStacked}</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ChartContainer config={chartConfig}>
              <BarChart data={analytics.weeklyStackedDuration.map((row) => ({ ...row, dayLabel: weekdayNames[row.day] }))}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="dayLabel" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent formatter={(value: number | string) => `${Number(value).toFixed(1)} ${t.analyticsHoursUnit}`} />} />
                {analytics.categoryShare.map((item, idx) => (
                  <Bar
                    key={item.key}
                    dataKey={item.key}
                    stackId="weekly"
                    fill={categoryColorMap[item.key] ?? COLOR_POOL[idx % COLOR_POOL.length]}
                  />
                ))}
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
