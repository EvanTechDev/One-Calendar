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
import { format, isSameDay, isWithinInterval, endOfDay, startOfDay, add } from "date-fns"
import { zhCN, enUS } from "date-fns/locale"
import { cn } from "@/lib/utils"
import type { CalendarEvent } from "../calendar"
import { isZhLanguage, translations, type Language } from "@/lib/i18n"

interface DayViewProps {
  date: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  onTimeSlotClick: (date: Date) => void
  language: Language
  timezone: string
  timeFormat: "24h" | "12h"
  onEditEvent?: (event: CalendarEvent) => void
  onDeleteEvent?: (event: CalendarEvent) => void
  onShareEvent?: (event: CalendarEvent) => void
  onBookmarkEvent?: (event: CalendarEvent) => void
  onEventDrop?: (event: CalendarEvent, newStartDate: Date, newEndDate: Date) => void // 新增拖拽事件处理函数
}

export default function DayView({ 
  date, 
  events, 
  onEventClick, 
  onTimeSlotClick, 
  language, 
  timezone,
  timeFormat,
  onEditEvent,
  onDeleteEvent,
  onShareEvent,
  onBookmarkEvent,
  onEventDrop
}: DayViewProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const hasScrolledRef = useRef(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const t = translations[language]
  const isZh = isZhLanguage(language)
  
  // 拖拽相关状态
  const [draggingEvent, setDraggingEvent] = useState<CalendarEvent | null>(null)
  const [dragStartPosition, setDragStartPosition] = useState<{ x: number; y: number } | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)
  const [dragPreview, setDragPreview] = useState<{ hour: number; minute: number } | null>(null)
  const [dragEventDuration, setDragEventDuration] = useState<number>(0) // 事件持续时间（分钟）
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isDraggingRef = useRef(false)

  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")

  const menuLabels = {
    edit: t.edit,
    share: t.share,
    bookmark: t.bookmark,
    delete: t.delete,
  }

  const formatTime = (hour: number) => {
    if (timeFormat === "12h") {
      const period = hour >= 12 ? "PM" : "AM"
      const twelveHour = hour % 12 || 12
      return `${twelveHour} ${period}`
    }
    return `${hour.toString().padStart(2, "0")}:00`
  }


  const formatHourMinute = (hour: number, minute: number) => {
    if (timeFormat === "12h") {
      const period = hour >= 12 ? "PM" : "AM"
      const twelveHour = hour % 12 || 12
      return `${twelveHour}:${minute.toString().padStart(2, "0")} ${period}`
    }
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
  }

  const formatDateWithTimezone = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      hour12: timeFormat === "12h",
      timeZone: timezone,
    }
    return new Intl.DateTimeFormat(isZh ? "zh-CN" : "en-US", options).format(date)
  }

  function getDarkerColorClass(color: string) {
    const colorMapping: Record<string, string> = {
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

    return colorMapping[color] || '#3A3A3A';
  }

  function getEventBackgroundColor(color: string) {
    if (!isDark) return undefined

    const darkModeColorMapping: Record<string, string> = {
      'bg-[#E6F6FD]': '#2F4655',
      'bg-[#E7F8F2]': '#2D4935',
      'bg-[#FEF5E6]': '#4F3F1B',
      'bg-[#FFE4E6]': '#6C2920',
      'bg-[#F3EEFE]': '#483A63',
      'bg-[#FCE7F3]': '#5A334A',
      'bg-[#E6FAF7]': '#1F4A47',
    }

    return darkModeColorMapping[color]
  }

  // 判断事件是否为全天事件
  const isAllDayEvent = (event: CalendarEvent) => {
    if (event.isAllDay) return true
    
    const start = new Date(event.startDate)
    const end = new Date(event.endDate)
    
    // 检查是否为00:00-23:59的事件或跨夜事件(00:00-次日00:00)
    const isFullDay = 
      start.getHours() === 0 && 
      start.getMinutes() === 0 && 
      ((end.getHours() === 23 && end.getMinutes() === 59) || 
       (end.getHours() === 0 && end.getMinutes() === 0 && end.getDate() !== start.getDate()))
    
    return isFullDay
  }

  // 检查事件是否跨天
  const isMultiDayEvent = (start: Date, end: Date) => {
    return (
      start.getDate() !== end.getDate() ||
      start.getMonth() !== end.getMonth() ||
      start.getFullYear() !== end.getFullYear()
    )
  }

  // 将事件分为全天事件和正常事件
  const separateEvents = (dayEvents: CalendarEvent[]) => {
    const allDayEvents: CalendarEvent[] = []
    const regularEvents: CalendarEvent[] = []

    dayEvents.forEach(event => {
      if (isAllDayEvent(event)) {
        allDayEvents.push(event)
      } else {
        regularEvents.push(event)
      }
    })

    return { allDayEvents, regularEvents }
  }

  // 修改自动滚动到当前时间的效果,只在组件挂载时执行一次
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
          // 滚动到当前小时的位置,并向上偏移100px使其在视图中间偏上
          scrollContainerRef.current.scrollTo({
            top: (currentHourElement as HTMLElement).offsetTop - 100,
            behavior: "auto",
          })

          // 标记已经滚动过
          hasScrolledRef.current = true
        }
      }
    }
  }, [date])

  // 修改时间更新逻辑,只更新时间线位置,不改变滚动位置
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

  // 添加全局mouseup/mousemove监听器来处理拖拽
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingEvent && isDraggingRef.current && dragStartPosition && scrollContainerRef.current) {
        // 计算鼠标相对于日历容器的位置
        const containerRect = scrollContainerRef.current.getBoundingClientRect();
        
        // 计算小时和分钟
        const relativeY = e.clientY - containerRect.top + scrollContainerRef.current.scrollTop;
        const hour = Math.floor(relativeY / 60);
        const minute = Math.floor((relativeY % 60) / 15) * 15; // 按15分钟取整
        
        setDragPreview({
          hour: hour,
          minute: minute
        });
      }
    };
    
    const handleMouseUp = () => {
      if (draggingEvent && isDraggingRef.current && dragPreview && onEventDrop) {
        // 计算新的开始和结束时间
        const newStartDate = new Date(date);
        newStartDate.setHours(dragPreview.hour, dragPreview.minute, 0, 0);
        
        // 计算新的结束时间 (保持事件持续时间不变)
        const newEndDate = add(newStartDate, { minutes: dragEventDuration });
        
        // 调用回调函数更新事件
        onEventDrop(draggingEvent, newStartDate, newEndDate);
      }
      
      // 清除拖拽状态
      isDraggingRef.current = false;
      setDraggingEvent(null);
      setDragStartPosition(null);
      setDragOffset(null);
      setDragPreview(null);
    };
    
    // 如果正在拖拽，添加全局事件监听器
    if (draggingEvent) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingEvent, dragStartPosition, dragPreview, onEventDrop, date, dragEventDuration]);

  // 获取当天的事件布局
  const layoutEvents = (events: CalendarEvent[]) => {
    if (!events || events.length === 0) return []

    // 按开始时间排序
    const sortedEvents = [...events].sort((a, b) => {
      const startA = new Date(a.startDate).getTime()
      const startB = new Date(b.startDate).getTime()
      return startA - startB
    })

    // 创建时间段数组,每个时间段包含在该时间段内活跃的事件
    type TimePoint = { time: number; isStart: boolean; eventIndex: number }
    const timePoints: TimePoint[] = []

    // 添加所有事件的开始和结束时间点
    sortedEvents.forEach((event, index) => {
      const start = new Date(event.startDate)
      const end = new Date(event.endDate)
      
      timePoints.push({ time: start.getTime(), isStart: true, eventIndex: index })
      timePoints.push({ time: end.getTime(), isStart: false, eventIndex: index })
    })

    // 按时间排序
    timePoints.sort((a, b) => {
      // 如果时间相同,结束时间点排在开始时间点之前
      if (a.time === b.time) {
        return a.isStart ? 1 : -1
      }
      return a.time - b.time
    })

    // 处理每个时间段
    const eventLayouts: Array<{
      event: CalendarEvent
      column: number
      totalColumns: number
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

      // 如果是最后一个时间点或下一个时间点与当前不同,处理当前时间段
      if (i === timePoints.length - 1 || timePoints[i + 1].time !== point.time) {
        // 计算当前活跃事件的布局
        const totalColumns =
          activeEvents.size > 0 ? Math.max(...Array.from(activeEvents).map((idx) => eventToColumn.get(idx)!)) + 1 : 0

        // 更新所有活跃事件的总列数
        activeEvents.forEach((eventIndex) => {
          const column = eventToColumn.get(eventIndex)!
          const event = sortedEvents[eventIndex]

          // 检查是否已经添加过这个事件
          const existingLayout = eventLayouts.find((layout) => layout.event.id === event.id)

          if (!existingLayout) {
            eventLayouts.push({
              event,
              column,
              totalColumns: Math.max(totalColumns, 1),
            })
          }
        })
      }
    }

    return eventLayouts
  }

  // 处理事件拖拽开始
  const handleEventDragStart = (event: CalendarEvent, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 使用定时器模拟长按效果，约300毫秒
    longPressTimeoutRef.current = setTimeout(() => {
      const start = new Date(event.startDate);
      const end = new Date(event.endDate);
      
      // 计算事件持续时间（分钟）
      const durationMs = end.getTime() - start.getTime();
      const durationMinutes = Math.round(durationMs / (1000 * 60));
      
      setDraggingEvent(event);
      setDragStartPosition({ x: e.clientX, y: e.clientY });
      setDragEventDuration(durationMinutes);
      isDraggingRef.current = true;
    }, 300);
  };
  
  // 处理事件拖拽结束
  const handleEventDragEnd = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  // 处理时间格子点击,根据点击位置确定更精确的时间
  const handleTimeSlotClick = (hour: number, event: React.MouseEvent<HTMLDivElement>) => {
    // 获取点击位置在时间格子内的相对位置
    const rect = event.currentTarget.getBoundingClientRect()
    const relativeY = event.clientY - rect.top
    const cellHeight = rect.height

    // 根据点击位置确定分钟数
    // 如果点击在格子的上半部分,分钟为0,否则为30
    const minutes = relativeY < cellHeight / 2 ? 0 : 30

    // 创建一个新的日期对象,设置为当前日期的指定小时和分钟
    const clickTime = new Date(date)
    clickTime.setHours(hour, minutes, 0, 0)

    // 调用传入的回调函数
    onTimeSlotClick(clickTime)
  }

  // 渲染全天事件的函数
  const renderAllDayEvents = (allDayEvents: CalendarEvent[]) => {
    // 设置事件之间的间隔大小
    const eventSpacing = 3;
    
    return allDayEvents.map((event, index) => (
      <ContextMenu key={`allday-${event.id}`}>
        <ContextMenuTrigger asChild>
          <div
            className={cn("relative rounded-lg p-1 text-xs cursor-pointer overflow-hidden", event.color)}
            style={{
              height: "20px",
              top: index * (20 + eventSpacing) + "px",
              position: "absolute",
              left: "0",
              right: "0",
              opacity: isDark ? 1 : 0.9,
              backgroundColor: getEventBackgroundColor(event.color),
              zIndex: 10 + index,
            }}
            onMouseDown={(e) => handleEventDragStart(event, e)}
            onMouseUp={handleEventDragEnd}
            onMouseLeave={handleEventDragEnd}
            onClick={(e) => {
              e.stopPropagation()
              if (!isDraggingRef.current) {
                onEventClick(event)
              }
            }}
          >
            <div 
              className={cn("absolute left-0 top-0 w-1 h-full rounded-l-md")} 
              style={{ backgroundColor: getDarkerColorClass(event.color) }} 
            />
            <div className="pl-1.5 truncate" style={{ color: getDarkerColorClass(event.color) }}>
              {event.title}
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
    ))
  }

  // 渲染拖拽预览
  const renderDragPreview = () => {
    if (!dragPreview || !draggingEvent) return null;
    
    const startMinutes = dragPreview.hour * 60 + dragPreview.minute;
    const endMinutes = startMinutes + dragEventDuration;
    
    return (
      <div
        className={cn("absolute rounded-lg p-2 text-sm overflow-hidden", draggingEvent.color)}
        style={{
          top: `${startMinutes}px`,
          height: `${dragEventDuration}px`,
          opacity: 0.6,
          width: `calc(100% - 4px)`,
          left: '2px',
          zIndex: 100,
          border: '2px dashed white',
          pointerEvents: 'none',
        }}
      >
        <div className={cn("absolute left-0 top-0 w-1 h-full rounded-l-md")} 
          style={{ backgroundColor: getDarkerColorClass(draggingEvent.color) }} 
        />
        <div className="pl-1">
          <div className="font-medium truncate" style={{ color: getDarkerColorClass(draggingEvent.color) }}>{draggingEvent.title}</div>
          {dragEventDuration >= 40 && (
            <div className="text-xs text-white/90 truncate">
              {formatHourMinute(dragPreview.hour, dragPreview.minute)} - {formatHourMinute(Math.floor(endMinutes / 60), endMinutes % 60)}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 获取当前日期的事件
  const dayEvents = events.filter(event => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    
    // 非全天事件使用原有逻辑检查
    if (!isAllDayEvent(event)) {
      if (isSameDay(start, date)) return true;
      
      if (isMultiDayEvent(start, end)) {
        return isWithinInterval(date, { start, end });
      }
      
      return false;
    }

    if (isMultiDayEvent(start, end)) {
      return isSameDay(start, date);
    }
    
    return isSameDay(start, date);
  });
  
  // 分离全天事件和普通事件
  const { allDayEvents, regularEvents } = separateEvents(dayEvents);
  
  // 计算全天事件区域的高度
  const eventSpacing = 2; // 保持与renderAllDayEvents函数中相同的值
  const allDayEventsHeight = allDayEvents.length > 0 
    ? allDayEvents.length * 20 + (allDayEvents.length - 1) * eventSpacing 
    : 0;
  
  // 对普通事件进行布局
  const eventLayouts = layoutEvents(regularEvents);

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-[100px_1fr] border-b relative z-30 bg-background">
        <div className="py-2 text-center">
          <div className="text-sm text-muted-foreground">
            {format(date, "E", { locale: isZh ? zhCN : enUS })}
          </div>
          <div className="text-3xl font-semibold text-[#0066ff] green:text-[#24a854] orange:text-[#e26912] azalea:text-[#CD2F7B] pink:text-[#FFAFA5]">{format(date, "d")}</div>
        </div>
        <div className="p-2">
          {/* 全天事件区域 */}
          <div 
            className="relative" 
            style={{ height: allDayEventsHeight + "px" }}
          >
            {renderAllDayEvents(allDayEvents)}
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-[100px_1fr] overflow-auto" ref={scrollContainerRef}>
        <div className="text-sm text-muted-foreground">
          {hours.map((hour) => (
            <div key={hour} className="h-[60px] relative">
              <span className="absolute top-0 right-4 -translate-y-1/2">{formatTime(hour)}</span>
            </div>
          ))}
        </div>

        <div className="relative border-l">
          {hours.map((hour) => (
            <div
              key={hour}
              className="h-[60px] border-t"
              onClick={(e) => handleTimeSlotClick(hour, e)}
            />
          ))}

          {eventLayouts.map(({ event, column, totalColumns }) => {
            const start = new Date(event.startDate);
            const end = new Date(event.endDate);
            
            const startMinutes = start.getHours() * 60 + start.getMinutes()
            const endMinutes = end.getHours() * 60 + end.getMinutes()
            const duration = endMinutes - startMinutes

            // 确保事件不会超出当天的时间范围
            const maxEndMinutes = 24 * 60 // 最大到午夜
            const displayDuration = Math.min(duration, maxEndMinutes - startMinutes)

            // 设置最小高度,确保短事件也能显示文本
            const minHeight = 20 // 最小高度为20px
            const height = Math.max(displayDuration, minHeight)

            // 计算事件宽度和位置,处理重叠
            const width = `calc((100% - 8px) / ${totalColumns})`
            const left = `calc(${column} * ${width})`

            return (
              <ContextMenu key={event.id}>
                <ContextMenuTrigger asChild>
                  <div
                    className={cn("relative absolute rounded-lg p-2 text-sm cursor-pointer overflow-hidden", event.color)}
                    style={{
                      top: `${startMinutes}px`,
                      height: `${height}px`,
                      opacity: isDark ? 1 : 0.9,
                      backgroundColor: getEventBackgroundColor(event.color),
                      width,
                      left,
                      zIndex: column + 1,
                    }}
                    onMouseDown={(e) => handleEventDragStart(event, e)}
                    onMouseUp={handleEventDragEnd}
                    onMouseLeave={handleEventDragEnd}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!isDraggingRef.current) {
                        onEventClick(event)
                      }
                    }}
                  >
                   <div className={cn("absolute left-0 top-0 w-1 h-full rounded-l-md")} style={{ backgroundColor: getDarkerColorClass(event.color) }} />
                    <div className="pl-1">
                    <div
                      className="font-medium leading-tight break-words"
                      style={{
                        color: getDarkerColorClass(event.color),
                        display: "-webkit-box",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: Math.max(1, Math.floor((height - 8) / 16)),
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {event.title}
                    </div>
                    {height >= 40 && (
                      <div className="text-xs truncate" style={{ color: getDarkerColorClass(event.color) }}>
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

          {/* 拖拽预览 */}
          {dragPreview && renderDragPreview()}

          {(() => {
            // 检查当前日期是否是今天
            const today = new Date()
            const isToday = isSameDay(date, today)

            // 只在今天显示时间指示器
            if (!isToday) return null

            // 获取当前时区的时间
            const currentTimeInTimezone = new Date(currentTime.toLocaleString("en-US", { timeZone: timezone }))
            const currentHours = currentTimeInTimezone.getHours()
            const currentMinutes = currentTimeInTimezone.getMinutes()

            // 计算像素位置
            const topPosition = currentHours * 60 + currentMinutes

            return (
              <div
                className="absolute left-0 right-0 border-t-2 border-[#0066FF] z-0 green:border-[#24a854] orange:border-[#e26912] azalea:border-[#CD2F7B] pink:border-[#FFAFA5]"
                style={{
                  top: `${topPosition}px`,
                }}
              />
            )
          })()}
        </div>
      </div>

      {draggingEvent && (
        <div 
          className="fixed px-2 py-1 bg-black text-white rounded-md text-xs z-50 pointer-events-none"
          style={{
            left: dragOffset ? dragStartPosition!.x + dragOffset.x + 10 : dragStartPosition!.x + 10,
            top: dragOffset ? dragStartPosition!.y + dragOffset.y + 10 : dragStartPosition!.y + 10,
            opacity: 0.8,
          }}
        >
          {t.dragToNewPosition}
        </div>
      )}
    </div>
  )
}
