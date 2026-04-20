import {
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfDay,
  format,
  getDay,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  subDays,
} from 'date-fns'
import type { CalendarEvent } from '@/components/app/calendar'
import type { AnalyticsEvent, DateRange } from './analytics-types'

export type AnalyticsRangePreset = 'week' | 'month' | 'quarter'

export const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']


const COLOR_MAP: Record<string, string> = {
  'bg-blue-500': '#3b82f6',
  'bg-green-500': '#10b981',
  'bg-yellow-500': '#f59e0b',
  'bg-red-500': '#ef4444',
  'bg-purple-500': '#8b5cf6',
  'bg-pink-500': '#ec4899',
  'bg-teal-500': '#14b8a6',
  'bg-[#E6F6FD]': '#3B82F6',
  'bg-[#E7F8F2]': '#10B981',
  'bg-[#FEF5E6]': '#F59E0B',
  'bg-[#FFE4E6]': '#EF4444',
  'bg-[#F3EEFE]': '#8B5CF6',
  'bg-[#FCE7F3]': '#EC4899',
  'bg-[#EEF2FF]': '#6366F1',
  'bg-[#FFF0E5]': '#FB923C',
  'bg-[#E6FAF7]': '#14B8A6',
}

export const normalizeChartColor = (input: string | undefined): string => {
  if (!input) return '#64748b'
  if (
    input.startsWith('#') ||
    input.startsWith('rgb') ||
    input.startsWith('hsl') ||
    input.startsWith('oklch') ||
    input.startsWith('var(')
  ) {
    return input
  }
  if (COLOR_MAP[input]) {
    return COLOR_MAP[input]
  }
  const prefixed = input.startsWith('bg-') ? input : `bg-${input}`
  return COLOR_MAP[prefixed] ?? '#64748b'
}

export const resolveDateRange = (
  preset: AnalyticsRangePreset,
  now: Date,
): DateRange => {
  const end = endOfDay(now)
  if (preset === 'week') {
    return { start: startOfDay(subDays(now, 6)), end }
  }
  if (preset === 'month') {
    return { start: startOfDay(subDays(now, 29)), end }
  }
  return { start: startOfDay(subDays(now, 89)), end }
}

export const mapEventsToAnalyticsEvents = (
  events: CalendarEvent[],
): AnalyticsEvent[] => {
  return events
    .map((event) => {
      const raw = event as CalendarEvent & { createdAt?: string | Date }
      const start = raw.startDate instanceof Date ? raw.startDate : parseISO(String(raw.startDate))
      const end = raw.endDate instanceof Date ? raw.endDate : parseISO(String(raw.endDate))
      const createdAtRaw = raw.createdAt
      const createdAt = createdAtRaw
        ? createdAtRaw instanceof Date
          ? createdAtRaw
          : parseISO(String(createdAtRaw))
        : start

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return null
      }

      return {
        id: event.id,
        start,
        end,
        category: event.calendarId || 'uncategorized',
        color: normalizeChartColor(event.color),
        createdAt: Number.isNaN(createdAt.getTime()) ? start : createdAt,
      }
    })
    .filter((event): event is AnalyticsEvent => event !== null)
}

export const filterEventsInRange = (
  events: AnalyticsEvent[],
  range: DateRange,
): AnalyticsEvent[] => {
  return events.filter((event) =>
    isWithinInterval(event.start, {
      start: range.start,
      end: range.end,
    }),
  )
}

export const getPreviousRange = (range: DateRange): DateRange => {
  const length = differenceInCalendarDays(range.end, range.start) + 1
  const previousEnd = endOfDay(subDays(range.start, 1))
  const previousStart = startOfDay(subDays(previousEnd, length - 1))
  return { start: previousStart, end: previousEnd }
}

export const generateRangeDays = (range: DateRange): Date[] => {
  return eachDayOfInterval({ start: range.start, end: range.end })
}

export const groupDayKey = (date: Date): string => format(date, 'yyyy-MM-dd')

export const groupMonthKey = (date: Date): string => format(startOfMonth(date), 'yyyy-MM')

export const getMonthDays = (year: number): Date[] => {
  return eachDayOfInterval({
    start: new Date(year, 0, 1),
    end: new Date(year, 11, 31),
  })
}

export const toMondayIndex = (date: Date): number => {
  const day = getDay(date)
  return day === 0 ? 6 : day - 1
}

export const formatHourRange = (startHour: number): string => {
  const endHour = (startHour + 2) % 24
  return `${String(startHour).padStart(2, '0')}:00 — ${String(endHour).padStart(2, '0')}:00`
}

export const calculateDaySpanInHours = (start: Date, end: Date): number => {
  const ms = end.getTime() - start.getTime()
  return Math.max(ms / (1000 * 60 * 60), 0)
}

export const addDurationByDayCategory = (
  bucket: Record<string, Record<string, { hours: number; color: string }>>,
  dayLabel: string,
  category: string,
  color: string,
  hours: number,
): void => {
  if (!bucket[dayLabel]) {
    bucket[dayLabel] = {}
  }
  if (!bucket[dayLabel][category]) {
    bucket[dayLabel][category] = { hours: 0, color }
  }
  bucket[dayLabel][category].hours += hours
}
