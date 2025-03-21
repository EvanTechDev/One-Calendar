"use client"

import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isWithinInterval } from "date-fns"
import { zhCN, enUS } from "date-fns/locale"
import { cn } from "@/lib/utils"
import type { Language } from "@/lib/i18n"

interface WeekViewProps {
  date: Date
  events: any[]
  onEventClick: (event: any) => void
  language: Language
  firstDayOfWeek: number
  timezone: string
}

interface CalendarEvent {
  id: string
  startDate: string | Date
  endDate: string | Date
  title: string
  color: string
}

export default function WeekView({ date, events, onEventClick, language, firstDayOfWeek, timezone }: WeekViewProps) {
  const weekStart = startOfWeek(date, { weekStartsOn: firstDayOfWeek })
  const weekEnd = endOfWeek(date, { weekStartsOn: firstDayOfWeek })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const hours = Array.from({ length: 24 }, (_, i) => i)

  const formatTime = (hour: number) => {
    return `${hour.toString().padStart(2, "0")}:00`
  }

  const formatDateWithTimezone = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone,
    }
    return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", options).format(date)
  }

  // 安全地检查事件是否跨越多天
  const isMultiDayEvent = (start: Date, end: Date) => {
    if (!start || !end) return false

    return (
      start.getDate() !== end.getDate() ||
      start.getMonth() !== end.getMonth() ||
      start.getFullYear() !== end.getFullYear()
    )
  }

  // 检查事件是否在特定日期显示
  const shouldShowEventOnDay = (event: CalendarEvent, day: Date) => {
    const start = new Date(event.startDate)
    const end = new Date(event.endDate)

    // 如果事件在当天开始
    if (isSameDay(start, day)) return true

    // 如果是多天事件，检查当天是否在事件范围内
    if (isMultiDayEvent(start, end)) {
      return isWithinInterval(day, { start, end })
    }

    return false
  }

  // 计算事件在特定日期的开始和结束时间
  const getEventTimesForDay = (event: CalendarEvent, day: Date) => {
    const start = new Date(event.startDate)
    const end = new Date(event.endDate)

    // 安全检查
    if (!start || !end) return null

    const isMultiDay = isMultiDayEvent(start, end)

    // 计算当天的开始和结束时间
    let dayStart = start
    let dayEnd = end

    if (isMultiDay) {
      // 如果不是事件的开始日，从当天0点开始
      if (!isSameDay(start, day)) {
        dayStart = new Date(day)
        dayStart.setHours(0, 0, 0, 0)
      }

      // 如果不是事件的结束日，到当天24点结束
      if (!isSameDay(end, day)) {
        dayEnd = new Date(day)
        dayEnd.setHours(23, 59, 59, 999)
      }
    }

    return {
      start: dayStart,
      end: dayEnd,
      isMultiDay,
    }
  }

  // 改进的事件布局算法，处理重叠事件
  const layoutEventsForDay = (dayEvents: CalendarEvent[], day: Date) => {
    if (dayEvents.length === 0) return []

    // 获取当天的事件时间
    const eventsWithTimes = dayEvents
      .map((event) => {
        const times = getEventTimesForDay(event, day)
        if (!times) return null
        return { event, ...times }
      })
      .filter(Boolean) as Array<{
      event: CalendarEvent
      start: Date
      end: Date
      isMultiDay: boolean
    }>

    // 按开始时间排序
    eventsWithTimes.sort((a, b) => a.start.getTime() - b.start.getTime())

    // 创建时间段数组，每个时间段包含在该时间段内活跃的事件
    type TimePoint = { time: number; isStart: boolean; eventIndex: number }
    const timePoints: TimePoint[] = []

    // 添加所有事件的开始和结束时间点
    eventsWithTimes.forEach((eventWithTime, index) => {
      const startTime = eventWithTime.start.getTime()
      const endTime = eventWithTime.end.getTime()

      timePoints.push({ time: startTime, isStart: true, eventIndex: index })
      timePoints.push({ time: endTime, isStart: false, eventIndex: index })
    })

    // 按时间排序
    timePoints.sort((a, b) => {
      // 如果时间相同，结束时间点排在开始时间点之前
      if (a.time === b.time) {
        return a.isStart ? 1 : -1
      }
      return a.time - b.time
    })

    // 处理每个时间段
    const eventLayouts: Array<{
      event: CalendarEvent
      start: Date
      end: Date
      column: number
      totalColumns: number
      isMultiDay: boolean
    }> = []

    // 当前活跃的事件
    const activeEvents = new Set<number>()
    // 事件到列的映射
    const eventToColumn = new Map<number, number>()

    for (let i = 0; i < timePoints.length; i++) {
      const point = timePoints[i]

      if (point.isStart) {
        // 事件开始
        activeEvents.add(point.eventIndex)

        // 找到可用的最小列号
        let column = 0
        const usedColumns = new Set<number>()

        // 收集当前已使用的列
        activeEvents.forEach((eventIndex) => {
          if (eventToColumn.has(eventIndex)) {
            usedColumns.add(eventToColumn.get(eventIndex)!)
          }
        })

        // 找到第一个未使用的列
        while (usedColumns.has(column)) {
          column++
        }

        // 分配列
        eventToColumn.set(point.eventIndex, column)
      } else {
        // 事件结束
        activeEvents.delete(point.eventIndex)
      }

      // 如果是最后一个时间点或下一个时间点与当前不同，处理当前时间段
      if (i === timePoints.length - 1 || timePoints[i + 1].time !== point.time) {
        // 计算当前活跃事件的布局
        const totalColumns =
          activeEvents.size > 0 ? Math.max(...Array.from(activeEvents).map((idx) => eventToColumn.get(idx)!)) + 1 : 0

        // 更新所有活跃事件的总列数
        activeEvents.forEach((eventIndex) => {
          const column = eventToColumn.get(eventIndex)!
          const { event, start, end, isMultiDay } = eventsWithTimes[eventIndex]

          // 检查是否已经添加过这个事件
          const existingLayout = eventLayouts.find((layout) => layout.event.id === event.id)

          if (!existingLayout) {
            eventLayouts.push({
              event,
              start,
              end,
              column,
              totalColumns: Math.max(totalColumns, 1),
              isMultiDay,
            })
          }
        })
      }
    }

    return eventLayouts
  }

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-[100px_repeat(7,1fr)] border-b">
        <div />
        {weekDays.map((day) => (
          <div key={day.toString()} className="text-center py-2">
            <div>{format(day, "E", { locale: language === "zh" ? zhCN : enUS })}</div>
            <div>{format(day, "d")}</div>
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-[100px_repeat(7,1fr)] overflow-auto">
        <div className="text-sm text-muted-foreground">
          {hours.map((hour) => (
            <div key={hour} className="h-[60px] relative">
              {/* 修复时间标签位置，特别是0:00的显示问题 */}
              <span className="absolute top-0 right-4 -translate-y-1/2">{formatTime(hour)}</span>
            </div>
          ))}
        </div>

        {weekDays.map((day) => {
          // 获取当天的事件
          const dayEvents = events.filter((event) => shouldShowEventOnDay(event, day))
          // 对事件进行布局
          const eventLayouts = layoutEventsForDay(dayEvents, day)

          return (
            <div key={day.toString()} className="relative border-l">
              {hours.map((hour) => (
                <div key={hour} className="h-[60px] border-t border-gray-200" />
              ))}

              {eventLayouts.map(({ event, start, end, column, totalColumns }) => {
                const startMinutes = start.getHours() * 60 + start.getMinutes()
                const endMinutes = end.getHours() * 60 + end.getMinutes()
                const duration = endMinutes - startMinutes

                // 设置最小高度，确保短事件也能显示文本
                const minHeight = 20 // 最小高度为20px
                const height = Math.max(duration, minHeight)

                // 计算事件宽度和位置，处理重叠
                const width = `calc((100% - 4px) / ${totalColumns})`
                const left = `calc(${column} * ${width})`

                return (
                  <div
                    key={`${event.id}-${day.toISOString().split("T")[0]}`}
                    className={cn("absolute rounded-lg p-2 text-sm cursor-pointer overflow-hidden", event.color)}
                    style={{
                      top: `${startMinutes}px`,
                      height: `${height}px`,
                      opacity: 0.9,
                      width,
                      left,
                      zIndex: column + 1, // 确保后面的事件在上层
                    }}
                    onClick={() => onEventClick(event)}
                  >
                    <div className="font-medium text-white truncate">{event.title}</div>
                    {height >= 40 && ( // 只在高度足够时显示时间
                      <div className="text-xs text-white/90 truncate">
                        {formatDateWithTimezone(start)} - {formatDateWithTimezone(end)}
                      </div>
                    )}
                  </div>
                )
              })}

              {isSameDay(day, new Date()) && (
                <div
                  className="absolute left-0 right-0 border-t-2 border-red-500 z-10"
                  style={{
                    top: `${new Date().getHours() * 60 + new Date().getMinutes()}px`,
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

