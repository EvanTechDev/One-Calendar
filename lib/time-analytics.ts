import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
  subWeeks,
} from "date-fns";

export interface TimeCategory {
  id: string;
  name: string;
  color: string;
  keywords?: string[];
}

export interface CalendarEventLike {
  id: string;
  title: string;
  startDate: Date | string;
  endDate: Date | string;
  isAllDay?: boolean;
  description?: string;
  calendarId?: string;
}

export interface AnalyticsRangeOption {
  key: "7d" | "30d" | "90d" | "1y";
  label: string;
  start: Date;
  end: Date;
}

export type DayPartKey = "allDay" | "morning" | "afternoon" | "evening" | "lateNight";

export interface ScheduleAnalytics {
  dailyOrMonthlyCounts: Array<{ label: string; count: number }>;
  yearlyHeatmap: Array<{ date: string; week: number; day: number; count: number }>;
  categoryShare: Array<{ key: string; label: string; count: number; hours: number }>;
  radarDistribution: Array<{ subject: string; value: number }>;
  busySlots: Array<{ weekday: number; part: DayPartKey; count: number }>;
  idleSlots: Array<{ weekday: number; part: DayPartKey; count: number }>;
  periodComparison: {
    mode: "week" | "month";
    currentLabel: string;
    previousLabel: string;
    currentCount: number;
    previousCount: number;
    delta: number;
    ratio: number;
  };
  categoryAvgDuration: Array<{ category: string; avgMinutes: number }>;
  weeklyStackedDuration: Array<Record<string, number | string> & { day: number }>;
}

interface NormalizedEvent {
  title: string;
  description: string;
  start: Date;
  end: Date;
  calendarId?: string;
  isAllDay: boolean;
}

const DAY_PARTS: Array<{ key: DayPartKey; from: number; to: number }> = [
  { key: "allDay", from: -1, to: -1 },
  { key: "morning", from: 5, to: 12 },
  { key: "afternoon", from: 12, to: 18 },
  { key: "evening", from: 18, to: 24 },
  { key: "lateNight", from: 0, to: 5 },
];

function normalizeEvents(events: CalendarEventLike[]): NormalizedEvent[] {
  const normalized: NormalizedEvent[] = [];

  events.forEach((event) => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return;
    }

    normalized.push({
      title: event.title ?? "",
      description: event.description ?? "",
      start,
      end: end > start ? end : addDays(start, 1),
      calendarId: event.calendarId,
      isAllDay: Boolean(event.isAllDay),
    });
  });

  return normalized;
}

function getEventDurationMinutes(event: NormalizedEvent): number {
  if (event.isAllDay) {
    const days = Math.max(1, differenceInCalendarDays(event.end, event.start));
    return days * 24 * 60;
  }
  return Math.max(1, Math.round((event.end.getTime() - event.start.getTime()) / 60000));
}

function resolveCategory(event: NormalizedEvent, categories: TimeCategory[]): TimeCategory | null {
  if (event.calendarId) {
    const matched = categories.find((c) => c.id === event.calendarId);
    if (matched) return matched;
  }

  const target = `${event.title} ${event.description}`.toLowerCase();
  return (
    categories.find((c) =>
      (c.keywords ?? []).some((keyword) => keyword && target.includes(keyword.toLowerCase())),
    ) ?? null
  );
}

function dayIndexMonday(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function buildAnalyticsRange(
  key: AnalyticsRangeOption["key"],
  labels?: Partial<Record<AnalyticsRangeOption["key"], string>>,
): AnalyticsRangeOption {
  const today = new Date();
  const end = endOfDay(today);

  const resolved = {
    "7d": labels?.["7d"] ?? "Last 7 days",
    "30d": labels?.["30d"] ?? "Last 30 days",
    "90d": labels?.["90d"] ?? "Last 90 days",
    "1y": labels?.["1y"] ?? "Last 1 year",
  };

  if (key === "7d") {
    return { key, label: resolved["7d"], start: startOfDay(addDays(today, -6)), end };
  }
  if (key === "30d") {
    return { key, label: resolved["30d"], start: startOfDay(addDays(today, -29)), end };
  }
  if (key === "90d") {
    return { key, label: resolved["90d"], start: startOfDay(addDays(today, -89)), end };
  }

  return { key, label: resolved["1y"], start: startOfDay(addDays(today, -364)), end };
}

export function generateScheduleAnalytics(params: {
  events: CalendarEventLike[];
  categories: TimeCategory[];
  range: AnalyticsRangeOption;
  granularity: "day" | "month";
  compareMode: "week" | "month";
  labels?: {
    uncategorized?: string;
    currentWeek?: string;
    previousWeek?: string;
    currentMonth?: string;
    previousMonth?: string;
  };
}): ScheduleAnalytics {
  const { events, categories, range, granularity, compareMode, labels } = params;
  const normalized = normalizeEvents(events);
  const inRange = normalized.filter((event) =>
    isWithinInterval(event.start, { start: range.start, end: range.end }),
  );

  const dailyOrMonthlyCounts =
    granularity === "day"
      ? eachDayOfInterval({ start: range.start, end: range.end }).map((day) => ({
          label: format(day, "MM/dd"),
          count: inRange.filter((event) => format(event.start, "yyyy-MM-dd") === format(day, "yyyy-MM-dd"))
            .length,
        }))
      : (() => {
          const result: Array<{ label: string; count: number }> = [];
          let cursor = startOfMonth(range.start);
          const limit = endOfMonth(range.end);
          while (cursor <= limit) {
            result.push({
              label: format(cursor, "yyyy-MM"),
              count: inRange.filter((event) => format(event.start, "yyyy-MM") === format(cursor, "yyyy-MM"))
                .length,
            });
            cursor = addMonths(cursor, 1);
          }
          return result;
        })();

  const yearStart = startOfWeek(startOfYear(new Date()), { weekStartsOn: 1 });
  const yearEnd = endOfWeek(endOfYear(new Date()), { weekStartsOn: 1 });
  const yearlyHeatmap = eachDayOfInterval({ start: yearStart, end: yearEnd }).map((day) => {
    const week = Math.floor(differenceInCalendarDays(day, yearStart) / 7);
    return {
      date: format(day, "yyyy-MM-dd"),
      week,
      day: dayIndexMonday(day),
      count: normalized.filter((event) => format(event.start, "yyyy-MM-dd") === format(day, "yyyy-MM-dd"))
        .length,
    };
  });

  const uncategorizedLabel = labels?.uncategorized ?? "Uncategorized";
  const categoryMap = new Map<string, { key: string; label: string; count: number; hours: number }>();
  inRange.forEach((event) => {
    const category = resolveCategory(event, categories);
    const key = category?.id ?? "uncategorized";
    const label = category?.name ?? uncategorizedLabel;
    const item = categoryMap.get(key) ?? { key, label, count: 0, hours: 0 };
    item.count += 1;
    item.hours += getEventDurationMinutes(event) / 60;
    categoryMap.set(key, item);
  });
  const categoryShare = Array.from(categoryMap.values()).sort((a, b) => b.count - a.count);

  const totalHours = categoryShare.reduce((sum, item) => sum + item.hours, 0);
  const radarDistribution = categoryShare.map((item) => ({
    subject: item.label,
    value: totalHours > 0 ? Number(((item.hours / totalHours) * 100).toFixed(1)) : 0,
  }));

  const slots = Array.from({ length: 7 }).flatMap((_, idx) =>
    DAY_PARTS.map((part) => ({ key: `${idx}-${part.key}`, weekday: idx, part: part.key, count: 0 })),
  );

  inRange.forEach((event) => {
    const weekday = dayIndexMonday(event.start);
    const hour = event.start.getHours();
    const matchedPart: DayPartKey = event.isAllDay
      ? "allDay"
      : DAY_PARTS.find((part) => part.from >= 0 && hour >= part.from && hour < part.to)?.key ?? "lateNight";
    const key = `${weekday}-${matchedPart}`;
    const target = slots.find((item) => item.key === key);
    if (target) target.count += 1;
  });

  const sortedBusy = [...slots].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  const busySlots = sortedBusy.slice(0, 5).map(({ weekday, part, count }) => ({ weekday, part, count }));
  const idleSlots = [...slots]
    .sort((a, b) => a.count - b.count || a.key.localeCompare(b.key))
    .slice(0, 5)
    .map(({ weekday, part, count }) => ({ weekday, part, count }));

  const now = new Date();
  const currentInterval =
    compareMode === "week"
      ? { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDay(now), label: labels?.currentWeek ?? "This week" }
      : { start: startOfMonth(now), end: endOfDay(now), label: labels?.currentMonth ?? "This month" };
  const previousInterval =
    compareMode === "week"
      ? {
          start: startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }),
          end: endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }),
          label: labels?.previousWeek ?? "Last week",
        }
      : {
          start: startOfMonth(subMonths(now, 1)),
          end: endOfMonth(subMonths(now, 1)),
          label: labels?.previousMonth ?? "Last month",
        };

  const currentCount = normalized.filter((event) =>
    isWithinInterval(event.start, { start: currentInterval.start, end: currentInterval.end }),
  ).length;
  const previousCount = normalized.filter((event) =>
    isWithinInterval(event.start, { start: previousInterval.start, end: previousInterval.end }),
  ).length;
  const delta = currentCount - previousCount;
  const ratio = previousCount === 0 ? (currentCount > 0 ? 100 : 0) : Number(((delta / previousCount) * 100).toFixed(1));

  const categoryAvgDuration = categoryShare
    .map((item) => ({ category: item.label, avgMinutes: item.count ? Number(((item.hours * 60) / item.count).toFixed(1)) : 0 }))
    .sort((a, b) => b.avgMinutes - a.avgMinutes);

  const categoryKeys = categoryShare.map((item) => item.key);
  const weeklyStackedDuration = Array.from({ length: 7 }).map((_, dayIndex) => {
    const row: Record<string, number | string> & { day: number } = { day: dayIndex };
    categoryKeys.forEach((key) => {
      row[key] = 0;
    });

    inRange
      .filter((event) => dayIndexMonday(event.start) === dayIndex)
      .forEach((event) => {
        const category = resolveCategory(event, categories);
        const key = category?.id ?? "uncategorized";
        row[key] = Number(row[key] ?? 0) + getEventDurationMinutes(event) / 60;
      });

    return row;
  });

  return {
    dailyOrMonthlyCounts,
    yearlyHeatmap,
    categoryShare,
    radarDistribution,
    busySlots,
    idleSlots,
    periodComparison: {
      mode: compareMode,
      currentLabel: currentInterval.label,
      previousLabel: previousInterval.label,
      currentCount,
      previousCount,
      delta,
      ratio,
    },
    categoryAvgDuration,
    weeklyStackedDuration,
  };
}
