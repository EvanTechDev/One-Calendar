"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Edit3, Share2, Bookmark, Trash2 } from "lucide-react"
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isWithinInterval } from "date-fns"
import { zhCN, enUS } from "date-fns/locale"
import { cn } from "@/lib/utils"
import type { Language } from "@/lib/i18n"

interface WeekViewProps {
  date: Date
  events: any[]
  onEventClick: (event: any) => void
  onTimeSlotClick: (date: Date) => void
  language: Language
  firstDayOfWeek: number
  timezone: string
  onEditEvent?: (event: CalendarEvent) => void
  onDeleteEvent?: (event: CalendarEvent) => void
  onShareEvent?: (event: CalendarEvent) => void
  onBookmarkEvent?: (event: CalendarEvent) => void
}

interface CalendarEvent {
  id: string
  startDate: string | Date
  endDate: string | Date
  title: string
  color: string
}

export default function WeekView({
  date,
  events,
  onEventClick,
  onTimeSlotClick,
  language,
  firstDayOfWeek,
  timezone,
  onEditEvent,
  onDeleteEvent,
  onShareEvent,
  onBookmarkEvent,
}: WeekViewProps) {
  const weekStart = startOfWeek(date, { weekStartsOn: firstDayOfWeek })
  const weekEnd = endOfWeek(date, { weekStartsOn: firstDayOfWeek })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const today = new Date() // 获取今天的日期

  const [currentTime, setCurrentTime] = useState(new Date())

  // Add this useEffect to update the time every minute
  const hasScrolledRef = useRef(false)

  const menuLabels = {
  edit: language === "zh" ? "修改" : "Edit",
  share: language === "zh" ? "分享" : "Share",
  bookmark: language === "zh" ? "书签" : "Bookmark",
  delete: language === "zh" ? "删除" : "Delete",
}

  function getDarkerColorClass(color: string) {
  const colorMapping: Record<string, string> = {
    'bg-blue-500': '#3C74C4',
    'bg-yellow-500': '#C39248',
    'bg-red-500': '#C14D4D',
    'bg-green-500': '#3C996C',
    'bg-purple-500': '#A44DB3',
    'bg-pink-500': '#C14D84',
    'bg-indigo-500': '#3D63B3',
    'bg-orange-500': '#C27048',
    'bg-teal-500': '#3C8D8D',
  }

  return colorMapping[color] || '#3A3A3A';
  }

  // 修改自动滚动到当前时间的效果，只在组件挂载时执行一次
  useEffect(() => {
    // 只在组件挂载时执行一次滚动
    if (!hasScrolledRef.current && scrollContainerRef.current) {
      const now = new Date()
      const currentHour = now.getHours()

      // 找到对应当前小时的DOM元素
      const hourElements = scrollContainerRef.current.querySelectorAll(".h-\\[60px\\]")
      if (hourElements.length > 0 && currentHour < hourElements.length) {
        // 获取当前小时的元素
        const currentHourElement = hourElements[currentHour + 1] // +1 是因为第一行是时间标签

        if (currentHourElement) {
          // 滚动到当前小时的位置，并向上偏移100px使其在视图中间偏上
          scrollContainerRef.current.scrollTo({
            top: (currentHourElement as HTMLElement).offsetTop - 100,
            behavior: "auto",
          })

          // 标记已经滚动过
          hasScrolledRef.current = true
        }
      }
    }
  }, [date, weekDays])

  // 修改时间更新逻辑，只更新时间线位置，不改变滚动位置
  useEffect(() => {
    // 立即更新时间
    setCurrentTime(new Date())

    // 设置定时器每分钟更新时间
    const interval = setInterval(() => {
      setCurrentTime(new Date())
      // 不再调用滚动函数
    }, 60000) // 60000 ms = 1 分钟

    return () => clearInterval(interval)
  }, [])

  const formatTime = (hour: number) => {
    // 使用24小时制格式化时间
    return `${hour.toString().padStart(2, "0")}:00`
  }

  const formatDateWithTimezone = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false, // 使用24小时制
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
    if (!dayEvents || dayEvents.length === 0) return []

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

  // 处理时间格子点击，根据点击位置确定更精确的时间
  const handleTimeSlotClick = (day: Date, hour: number, event: React.MouseEvent<HTMLDivElement>) => {
    // 获取点击位置在时间格子内的相对位置
    const rect = event.currentTarget.getBoundingClientRect()
    const relativeY = event.clientY - rect.top
    const cellHeight = rect.height

    // 根据点击位置确定分钟数
    // 如果点击在格子的上半部分，分钟为0，否则为30
    const minutes = relativeY < cellHeight / 2 ? 0 : 30

    // 创建一个新的日期对象，设置为指定日期的指定小时和分钟
    const clickTime = new Date(day)
    clickTime.setHours(hour, minutes, 0, 0)

    // 调用传入的回调函数
    onTimeSlotClick(clickTime)
  }

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // 添加自动滚动到当前时间的效果
  // 添加自动滚动到当前时间的效果

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-[100px_repeat(7,1fr)] divide-x relative z-30 bg-background">
        <div className="sticky top-0 z-30 bg-background" />
        {weekDays.map((day) => (
          <div key={day.toString()} className="sticky top-0 z-30 bg-background p-2 text-center">
            <div>{format(day, "E", { locale: language === "zh" ? zhCN : enUS })}</div>
            {/* 如果是今天，使用蓝色高亮显示日期 */}
            <div className={cn(isSameDay(day, today) ? "text-[#0066FF] font-bold" : "")}>{format(day, "d")}</div>
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-[100px_repeat(7,1fr)] divide-x overflow-auto" ref={scrollContainerRef}>
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
                <div
                  key={hour}
                  className="h-[60px] border-t border-gray-200"
                  onClick={(e) => handleTimeSlotClick(day, hour, e)}
                />
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
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          key={`${event.id}-${day.toISOString().split("T")[0]}`}
                          className={cn("relative", "absolute rounded-lg p-2 text-sm cursor-pointer overflow-hidden", event.color)}
                          style={{
                            top: `${startMinutes}px`,
                            height: `${height}px`,
                            opacity: 0.9,
                            width,
                            left,
                            zIndex: column + 1,
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            onEventClick(event)
                          }}
                        >
                         <div className={cn("absolute left-0 top-0 w-2 h-full rounded-l-md")} style={{ backgroundColor: getDarkerColorClass(event.color) }} />
                          <div className="pl-1.5">
                          <div className="font-medium text-white truncate">{event.title}</div>
                          {height >= 40 && (
                            <div className="text-xs text-white/90 truncate">
                              {formatDateWithTimezone(start)} - {formatDateWithTimezone(end)}
                            </div>
                          )}
                          </div>
                        </div>
                      </ContextMenuTrigger>
    
                    <ContextMenuContent className="w-40">
                      <ContextMenuItem onClick={() => onEditEvent?.(event)}>
                        <Edit3 className="mr-2 h-4 w-4" />
                        {menuLabels.edit}
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => onShareEvent?.(event)}>
                        <Share2 className="mr-2 h-4 w-4" />
                        {menuLabels.share}
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => onBookmarkEvent?.(event)}>
                        <Bookmark className="mr-2 h-4 w-4" />
                        {menuLabels.bookmark}
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => onDeleteEvent?.(event)} className="text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" />
                        {menuLabels.delete}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                )
              })}

              {isSameDay(day, today) &&
                (() => {
                  // 获取当前时区的时间
                  const timeOptions: Intl.DateTimeFormatOptions = {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                    timeZone: timezone,
                  }

                  // 获取小时和分钟
                  const timeString = new Intl.DateTimeFormat("en-US", timeOptions).format(currentTime)
                  const [hoursStr, minutesStr] = timeString.split(":")
                  const currentHours = Number.parseInt(hoursStr, 10)
                  const currentMinutes = Number.parseInt(minutesStr, 10)

                  // 计算像素位置
                  const topPosition = currentHours * 60 + currentMinutes

                  return (
                    <div
                      className="absolute left-0 right-0 border-t-2 border-[#0066FF] z-0"
                      style={{
                        top: `${topPosition}px`,
                      }}
                    />
                  )
                })()}
            </div>
          )
        })}
      </div>
    </div>
  )
}
