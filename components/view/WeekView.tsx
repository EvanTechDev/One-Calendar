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
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isWithinInterval, add } from "date-fns"
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
  onEventDrop?: (event: CalendarEvent, newStartDate: Date, newEndDate: Date) => void // 新增拖拽事件处理函数
}

interface CalendarEvent {
  id: string
  startDate: string | Date
  endDate: string | Date
  title: string
  color: string
  isAllDay?: boolean
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
  onEventDrop, // 新增拖拽事件处理函数
}: WeekViewProps) {
  const weekStart = startOfWeek(date, { weekStartsOn: firstDayOfWeek })
  const weekEnd = endOfWeek(date, { weekStartsOn: firstDayOfWeek })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const today = new Date()

  const [currentTime, setCurrentTime] = useState(new Date())
  const hasScrolledRef = useRef(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  // 拖拽相关状态
  const [draggingEvent, setDraggingEvent] = useState<CalendarEvent | null>(null)
  const [dragStartPosition, setDragStartPosition] = useState<{ x: number; y: number } | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)
  const [dragPreview, setDragPreview] = useState<{ day: Date; hour: number; minute: number } | null>(null)
  const [dragEventDuration, setDragEventDuration] = useState<number>(0) // 事件持续时间（分钟）
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isDraggingRef = useRef(false)

  const menuLabels = {
    edit: language === "zh" ? "修改" : "Edit",
    share: language === "zh" ? "分享" : "Share",
    bookmark: language === "zh" ? "书签" : "Bookmark",
    delete: language === "zh" ? "删除" : "Delete",
  }

  function getDarkerColorClass(color: string) {
    const colorMapping: Record<string, string> = {
  'bg-[#E8F1FF]': '#3B82F6',
  'bg-[#E9F7EF]': '#10B981',
  'bg-[#FFF4D6]': '#F59E0B',
  'bg-[#FDECEC]': '#EF4444',
  'bg-[#F3ECFF]': '#8B5CF6',
  'bg-[#FCE7F3]': '#EC4899',
  'bg-[#FFF0E5]': '#FB923C',
  'bg-[#EEF2FF]': '#6366F1',
  'bg-[#E6FAF7]': '#14B8A6',
}


    return colorMapping[color] || '#3A3A3A';
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
  }, [date, weekDays])

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
        const gridItems = scrollContainerRef.current.querySelectorAll('.grid-col');
        
        // 找到最近的日期列
        let closestDayIndex = 0;
        let minDistance = Infinity;
        
        gridItems.forEach((item, index) => {
          const rect = item.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const distance = Math.abs(e.clientX - centerX);
          
          if (distance < minDistance) {
            minDistance = distance;
            closestDayIndex = index;
          }
        });
        
        // 计算小时和分钟
        const relativeY = e.clientY - containerRect.top + scrollContainerRef.current.scrollTop;
        const hour = Math.floor(relativeY / 60);
        const minute = Math.floor((relativeY % 60) / 15) * 15; // 按15分钟取整
        
        if (closestDayIndex < weekDays.length) {
          setDragPreview({
            day: weekDays[closestDayIndex],
            hour: hour,
            minute: minute
          });
        }
      }
    };
    
    const handleMouseUp = () => {
      if (draggingEvent && isDraggingRef.current && dragPreview && onEventDrop) {
        // 计算新的开始和结束时间
        const newStartDate = new Date(dragPreview.day);
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
  }, [draggingEvent, dragStartPosition, dragPreview, onEventDrop, weekDays, dragEventDuration]);

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

    // 如果是全天事件且跨天（00:00-次日00:00），只在开始当天显示
    if (isAllDayEvent(event) && isMultiDayEvent(start, end)) {
      return isSameDay(start, day)
    }

    // 如果事件在当天开始
    if (isSameDay(start, day)) return true

    // 如果是多天事件（且不是全天事件），检查当天是否在事件范围内
    if (isMultiDayEvent(start, end) && !isAllDayEvent(event)) {
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
      // 如果不是事件的开始日,从当天0点开始
      if (!isSameDay(start, day)) {
        dayStart = new Date(day)
        dayStart.setHours(0, 0, 0, 0)
      }

      // 如果不是事件的结束日,到当天24点结束
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

  // 将事件分为全天事件和正常事件
  const separateEvents = (dayEvents: CalendarEvent[], day: Date) => {
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

  // 改进的事件布局算法,处理重叠事件
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

    // 创建时间段数组,每个时间段包含在该时间段内活跃的事件
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
      // 如果时间相同,结束时间点排在开始时间点之前
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

      // 如果是最后一个时间点或下一个时间点与当前不同,处理当前时间段
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
  const handleTimeSlotClick = (day: Date, hour: number, event: React.MouseEvent<HTMLDivElement>) => {
    // 获取点击位置在时间格子内的相对位置
    const rect = event.currentTarget.getBoundingClientRect()
    const relativeY = event.clientY - rect.top
    const cellHeight = rect.height

    // 根据点击位置确定分钟数
    // 如果点击在格子的上半部分,分钟为0,否则为30
    const minutes = relativeY < cellHeight / 2 ? 0 : 30

    // 创建一个新的日期对象,设置为指定日期的指定小时和分钟
    const clickTime = new Date(day)
    clickTime.setHours(hour, minutes, 0, 0)

    // 调用传入的回调函数
    onTimeSlotClick(clickTime)
  }

  // 渲染全天事件的函数
  const renderAllDayEvents = (day: Date, allDayEvents: CalendarEvent[]) => {
    // 这里可以设置事件之间的间隔大小
    const eventSpacing = 2; // 调整这个值来改变事件之间的间隔，单位是像素
    
    return allDayEvents.map((event, index) => (
      <ContextMenu key={`allday-${event.id}-${day.toISOString().split("T")[0]}`}>
        <ContextMenuTrigger asChild>
          <div
            className={cn("relative rounded-lg p-1 text-xs cursor-pointer overflow-hidden", event.color)}
            style={{
              height: "20px",  // 固定高度
              // 在这里使用 eventSpacing 设置事件间隔
              top: index * (20 + eventSpacing) + "px", // 堆叠事件并添加间隔
              position: "absolute",
              left: "0",
              right: "0",
              opacity: 0.9,
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
              className={cn("absolute left-0 top-0 w-2 h-full rounded-l-md")} 
              style={{ backgroundColor: getDarkerColorClass(event.color) }} 
            />
            <div className="pl-1.5 truncate text-white">
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
    
    const dayIndex = weekDays.findIndex(day => isSameDay(day, dragPreview.day));
    if (dayIndex === -1) return null;
    
    const startMinutes = dragPreview.hour * 60 + dragPreview.minute;
    const endMinutes = startMinutes + dragEventDuration;
    
    return (
      <div
        className={cn("absolute rounded-lg p-2 text-sm cursor-pointer overflow-hidden", draggingEvent.color)}
        style={{
          top: `${startMinutes}px`,
          height: `${dragEventDuration}px`,
          opacity: 0.6,
          width: `calc(100% - 4px)`,
          left: '2px',
          zIndex: 100,
          border: '2px dashed white',
          pointerEvents: 'none', // 确保拖拽预览不会干扰鼠标事件
        }}
      >
        <div className={cn("absolute left-0 top-0 w-2 h-full rounded-l-md")} 
          style={{ backgroundColor: getDarkerColorClass(draggingEvent.color) }} 
        />
        <div className="pl-1.5">
          <div className="font-medium text-white truncate">{draggingEvent.title}</div>
          {dragEventDuration >= 40 && (
            <div className="text-xs text-white/90 truncate">
              {formatTime(dragPreview.hour)}:{dragPreview.minute.toString().padStart(2, '0')} - {formatTime(Math.floor(endMinutes / 60))}:{(endMinutes % 60).toString().padStart(2, '0')}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-[100px_repeat(7,1fr)] divide-x relative z-30 bg-background">
        <div className="sticky top-0 z-30 bg-background" />
        {weekDays.map((day) => {
          // 获取当天的事件
          const dayEvents = events.filter((event) => shouldShowEventOnDay(event, day))
          // 分离全天事件和普通事件
          const { allDayEvents } = separateEvents(dayEvents, day)
          
          // 计算全天事件区域的高度，没有间隔
          const eventSpacing = 2; // 保持与renderAllDayEvents函数中相同的值
          const allDayEventsHeight = allDayEvents.length > 0 
            ? allDayEvents.length * 20 + (allDayEvents.length - 1) * eventSpacing 
            : 0;
          
          return (
            <div key={day.toString()} className="sticky top-0 z-30 bg-background">
              <div className="p-2 text-center">
                <div>{format(day, "E", { locale: language === "zh" ? zhCN : enUS })}</div>
                {/* 如果是今天,使用蓝色高亮显示日期 */}
                <div className={cn(isSameDay(day, today) ? "text-[#0066FF] font-bold green:text-[#24a854] orange:text-[#e26912] azalea:text-[#CD2F7B] pink:text-[#FFAFA5]" : "")}>
                  {format(day, "d")}
                </div>
              </div>
              
              {/* 全天事件区域 */}
              <div 
                className="relative" 
                style={{ height: allDayEventsHeight + "px" }}
              >
                {renderAllDayEvents(day, allDayEvents)}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex-1 grid grid-cols-[100px_repeat(7,1fr)] divide-x overflow-auto" ref={scrollContainerRef}>
        <div className="text-sm text-muted-foreground">
          {hours.map((hour) => (
            <div key={hour} className="h-[60px] relative border-gray-200">
              <span className="absolute top-0 right-4 -translate-y-1/2">{formatTime(hour)}</span>
            </div>
          ))}
        </div>

        {weekDays.map((day, dayIndex) => {
          // 获取当天的事件
          const dayEvents = events.filter((event) => shouldShowEventOnDay(event, day))
          // 分离全天事件和普通事件
          const { regularEvents } = separateEvents(dayEvents, day)
          // 对事件进行布局
          const eventLayouts = layoutEventsForDay(regularEvents, day)

          return (
            <div key={day.toString()} className="relative border-l grid-col">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="h-[60px] border-t"
                  onClick={(e) => handleTimeSlotClick(day, hour, e)}
                />
              ))}

              {eventLayouts.map(({ event, start, end, column, totalColumns }) => {
                const startMinutes = start.getHours() * 60 + start.getMinutes()
                const endMinutes = end.getHours() * 60 + end.getMinutes()
                const duration = endMinutes - startMinutes

                // 设置最小高度,确保短事件也能显示文本
                const minHeight = 20 // 最小高度为20px
                const height = Math.max(duration, minHeight)

                // 计算事件宽度和位置,处理重叠
                const width = `calc((100% - 4px) / ${totalColumns})`
                const left = `calc(${column} * ${width})`

                return (
                    <ContextMenu key={`${event.id}-${day.toISOString().split("T")[0]}`}>
                      <ContextMenuTrigger asChild>
                        <div
                          className={cn("relative absolute rounded-lg p-2 text-sm cursor-pointer overflow-hidden", event.color)}
                          style={{
                            top: `${startMinutes}px`,
                            height: `${height}px`,
                            // opacity: 0.9,
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
                          <div className="pl-1.5">
                          <div className="font-medium truncate" style={{ color: getDarkerColorClass(event.color) }}>{event.title}</div>
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

              {/* 如果当前日期列是拖拽预览的目标，显示拖拽预览 */}
              {dragPreview && isSameDay(dragPreview.day, day) && renderDragPreview()}

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
                      className="absolute left-0 right-0 border-t-2 border-[#0066FF] z-0 green:border-[#24a854] orange:border-[#e26912] azalea:border-[#CD2F7B] pink:border-[#FFAFA5]"
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
      
      {/* 全局拖拽提示，显示拖拽指示和事件信息 */}
      {draggingEvent && (
        <div 
          className="fixed px-2 py-1 bg-black text-white rounded-md text-xs z-50 pointer-events-none"
          style={{
            left: dragOffset ? dragStartPosition!.x + dragOffset.x + 10 : dragStartPosition!.x + 10,
            top: dragOffset ? dragStartPosition!.y + dragOffset.y + 10 : dragStartPosition!.y + 10,
            opacity: 0.8,
          }}
        >
          {language === "zh" ? "拖动到新位置" : "Drag to new position"}
        </div>
      )}
    </div>
  )
}
