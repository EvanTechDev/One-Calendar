"use client"

import { useEffect, useState, useRef } from "react"
import { useSearchParams } from "next/navigation"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { addDays } from "date-fns"
import { useCalendar } from "@/components/context/CalendarContext"
import { translations, useLanguage } from "@/lib/i18n"
import { toast } from "sonner"

interface EventFromUrl {
  title: string
  startDate: Date
  endDate: Date
  description?: string
  location?: string
  color?: string
  participants?: string[]
}

export default function EventUrlHandler() {
  const [events, setEvents] = useState<EventFromUrl[]>([])
  const [open, setOpen] = useState(false)
  const searchParams = useSearchParams()
  const { events: calendarEvents, setEvents: setCalendarEvents } = useCalendar()
  const [language] = useLanguage()
  const t = translations[language]
  // 添加一个ref来跟踪是否已经处理过URL参数
  const hasProcessedParams = useRef(false)

  useEffect(() => {
    // 只在组件挂载时处理一次URL参数，避免无限循环
    if (!hasProcessedParams.current && searchParams) {
      const parsedEvents = parseUrlParams(searchParams)
      if (parsedEvents.length > 0) {
        setEvents(parsedEvents)
        setOpen(true)
        // 标记为已处理
        hasProcessedParams.current = true
      }
    }
  }, []) // 移除searchParams依赖，只在挂载时执行一次

  const parseUrlParams = (params: URLSearchParams): EventFromUrl[] => {
    const events: EventFromUrl[] = []

    // 支持简单的多事件添加格式
    // events=event1|event2|event3 格式
    const eventsParam = params.get("events")
    if (eventsParam) {
      const eventsList = eventsParam.split("|")
      eventsList.forEach((eventString, index) => {
        // 解析简单格式的事件
        const eventParts = eventString.split(",")
        if (eventParts.length >= 1) {
          const title = eventParts[0] || t.unnamedEvent || "Unnamed Event"
          const startDate = eventParts[1] ? parseEventDate(eventParts[1]) : parseEventDate("tomorrow")
          const endDate = eventParts[2] ? parseEventDate(eventParts[2]) : new Date(startDate.getTime() + 60 * 60 * 1000) // 默认1小时后结束

          const event: EventFromUrl = {
            title,
            startDate,
            endDate,
            description: eventParts[3],
            location: eventParts[4],
            color: eventParts[5] ? `bg-${eventParts[5]}-500` : "bg-blue-500",
            participants: eventParts[6] ? eventParts[6].split("+").map((p) => p.trim()) : [],
          }

          events.push(event)
        }
      })
    }

    // 保留原有的 event1、event2 格式支持
    const eventParams = new Map<string, Record<string, string>>()

    // 收集所有事件参数
    for (const [key, value] of params.entries()) {
      // 跳过已经处理的 events 参数
      if (key === "events") continue

      // 检查是否是多事件格式 (event1_name, event2_date 等)
      const multiEventMatch = key.match(/^event(\d+)_(.+)$/)

      if (multiEventMatch) {
        const [, eventIndex, paramName] = multiEventMatch
        if (!eventParams.has(eventIndex)) {
          eventParams.set(eventIndex, {})
        }
        const eventData = eventParams.get(eventIndex)!
        eventData[paramName] = value
      } else {
        // 单事件格式，使用 "1" 作为默认索引
        if (!eventParams.has("1")) {
          eventParams.set("1", {})
        }
        const eventData = eventParams.get("1")!
        eventData[key] = value
      }
    }

    // 处理每个事件
    for (const [, eventData] of eventParams) {
      if (eventData.name || eventData.title) {
        const title = eventData.name || eventData.title || t.unnamedEvent || "Unnamed Event"
        const startDate = parseEventDate(eventData.date || eventData.startDate || "tomorrow")
        const endDate = eventData.endDate
          ? parseEventDate(eventData.endDate)
          : new Date(startDate.getTime() + 60 * 60 * 1000) // 默认1小时后结束

        // 处理参与者，如果有的话，将其分割为数组
        const participants = eventData.participants ? eventData.participants.split(",").map((p) => p.trim()) : []

        events.push({
          title,
          startDate,
          endDate,
          description: eventData.description,
          location: eventData.location,
          color: eventData.color ? `bg-${eventData.color}-500` : "bg-blue-500",
          participants,
        })
      }
    }

    return events
  }

  // 替换整个 parseEventDate 函数
  const parseEventDate = (dateStr: string): Date => {
    const now = new Date()
    now.setHours(9, 0, 0, 0) // 默认设置为上午9点开始

    // 处理特殊日期字符串
    if (dateStr.toLowerCase() === "tomorrow") {
      return addDays(now, 1)
    } else if (dateStr.toLowerCase() === "dayaftertomorrow" || dateStr.toLowerCase() === "aftertomorrow") {
      return addDays(now, 2)
    } else if (dateStr.match(/^(\d+)days?$/i)) {
      const daysMatch = dateStr.match(/^(\d+)days?$/i)
      const days = daysMatch ? Number.parseInt(daysMatch[1], 10) : 1
      return addDays(now, days)
    }

    // 处理新格式: 1h, 2.5h, 1d2:00 等
    // 相对时间格式: Xh, X.Yh, Xm
    const relativeTimeMatch = dateStr.match(/^(\d+(?:\.\d+)?)([hm])$/i)
    if (relativeTimeMatch) {
      const [, amount, unit] = relativeTimeMatch
      const numAmount = Number.parseFloat(amount)

      const result = new Date()
      if (unit.toLowerCase() === "h") {
        // 小时
        result.setTime(result.getTime() + numAmount * 60 * 60 * 1000)
      } else if (unit.toLowerCase() === "m") {
        // 分钟
        result.setTime(result.getTime() + numAmount * 60 * 1000)
      }
      return result
    }

    // 处理 1d2:00 格式 (X天后的某个时间点)
    const dayTimeMatch = dateStr.match(/^(\d+)d(\d{1,2}):(\d{2})$/i)
    if (dayTimeMatch) {
      const [, days, hours, minutes] = dayTimeMatch
      const numDays = Number.parseInt(days, 10)
      const numHours = Number.parseInt(hours, 10)
      const numMinutes = Number.parseInt(minutes, 10)

      const result = addDays(now, numDays)
      result.setHours(numHours, numMinutes, 0, 0)
      return result
    }

    // 处理组合格式 1d3h30m (X天X小时X分钟后)
    const combinedMatch = dateStr.match(/(?:(\d+)d)?(?:(\d+(?:\.\d+)?)h)?(?:(\d+)m)?/i)
    if (combinedMatch && (combinedMatch[1] || combinedMatch[2] || combinedMatch[3])) {
      const days = combinedMatch[1] ? Number.parseInt(combinedMatch[1], 10) : 0
      const hours = combinedMatch[2] ? Number.parseFloat(combinedMatch[2]) : 0
      const minutes = combinedMatch[3] ? Number.parseInt(combinedMatch[3], 10) : 0

      if (days > 0 || hours > 0 || minutes > 0) {
        const result = new Date()
        result.setTime(result.getTime() + days * 24 * 60 * 60 * 1000 + hours * 60 * 60 * 1000 + minutes * 60 * 1000)
        return result
      }
    }

    // 处理 yyyy.mm.dd.hh.minute 格式
    const customFormatMatch = dateStr.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})\.(\d{1,2})\.(\d{1,2})$/)
    if (customFormatMatch) {
      const [, yearStr, monthStr, dayStr, hourStr, minuteStr] = customFormatMatch
      const year = Number.parseInt(yearStr, 10)
      // 月份需要减1，因为JavaScript中月份是从0开始的
      const month = Number.parseInt(monthStr, 10) - 1
      const day = Number.parseInt(dayStr, 10)
      const hour = Number.parseInt(hourStr, 10)
      const minute = Number.parseInt(minuteStr, 10)

      return new Date(year, month, day, hour, minute)
    }

    // 尝试解析为标准日期
    const parsedDate = new Date(dateStr)
    return isNaN(parsedDate.getTime()) ? addDays(now, 1) : parsedDate
  }

  const handleConfirm = () => {
    // 将临时事件转换为日历事件并添加到日历中
    const newCalendarEvents = events.map((event) => ({
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      title: event.title,
      startDate: event.startDate,
      endDate: event.endDate,
      isAllDay: false,
      recurrence: "none" as const,
      location: event.location,
      participants: event.participants || [], // 使用事件中的参与者，如果没有则使用空数组
      notification: 15, // 默认提前15分钟通知
      description: event.description,
      color: event.color || "bg-blue-500",
      calendarId: "1", // 默认日历
    }))

    setCalendarEvents([...calendarEvents, ...newCalendarEvents])

    // 显示成功消息
    toast(language === "en" ? "Events Added" : "已添加日程", {
      description:
        language === "en"
          ? `Successfully added ${newCalendarEvents.length} events`
          : `成功添加 ${newCalendarEvents.length} 个日程`,
    })

    setOpen(false)

    // 清除URL参数 - 使用更安全的方式
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href)
      url.search = ""
      window.history.replaceState({}, "", url.toString())
    }
  }

  const handleCancel = () => {
    setOpen(false)
    // 清除URL参数
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href)
      url.search = ""
      window.history.replaceState({}, "", url.toString())
    }
  }

  const formatEventDate = (date: Date): string => {
    return date.toLocaleString(language === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (events.length === 0) return null

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{language === "en" ? "Add Events from URL" : "从链接添加日程"}</AlertDialogTitle>
          <AlertDialogDescription>
            {language === "en"
              ? "Would you like to add the following events to your calendar?"
              : "是否要将以下日程添加到您的日历中？"}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
          {events.map((event, index) => (
            <div key={index} className="mb-4 p-3 border rounded-md">
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded-full mr-2 ${event.color || "bg-blue-500"}`}></div>
                <h3 className="font-bold text-lg">{event.title}</h3>
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                <p>
                  {formatEventDate(event.startDate)} - {formatEventDate(event.endDate)}
                </p>
                {event.location && (
                  <p>
                    <span className="font-medium">{t.location}:</span> {event.location}
                  </p>
                )}
                {event.participants && event.participants.length > 0 && (
                  <p>
                    <span className="font-medium">{t.participants}:</span> {event.participants.join(", ")}
                  </p>
                )}
                {event.description && (
                  <p className="mt-1">
                    <span className="font-medium">{t.description}:</span> {event.description}
                  </p>
                )}
                <p>
                  <span className="font-medium">{t.color || "颜色"}:</span>{" "}
                  {event.color ? event.color.replace("bg-", "").replace("-500", "") : "blue"}
                </p>
              </div>
            </div>
          ))}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>{language === "en" ? "Cancel" : "取消"}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>{language === "en" ? "Add Events" : "添加日程"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

