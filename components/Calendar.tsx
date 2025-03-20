"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { CalendarIcon, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { addDays, subDays, startOfToday } from "date-fns"
import Sidebar from "./Sidebar"
import DayView from "./DayView"
import WeekView from "./WeekView"
import MonthView from "./MonthView"
import AnalyticsView from "./AnalyticsView"
import EventDialog from "./EventDialog"
import Settings from "./Settings"
import { translations, useLanguage } from "@/lib/i18n"
import {
  scheduleEventNotification,
  checkPendingNotifications,
  clearAllNotificationTimers,
  type NOTIFICATION_SOUNDS,
} from "@/utils/notifications"
import { toast } from "@/components/ui/use-toast"
// 在Calendar组件顶部导入QuickStartGuide
import EventPreview from "./EventPreview"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import { useCalendar } from "@/contexts/CalendarContext"
// 在import部分添加
import EventUrlHandler from "./EventUrlHandler"

type ViewType = "day" | "week" | "month" | "analytics"

export interface CalendarEvent {
  id: string
  title: string
  startDate: Date
  endDate: Date
  isAllDay: boolean
  recurrence: "none" | "daily" | "weekly" | "monthly" | "yearly"
  location?: string
  participants: string[]
  notification: number
  description?: string
  color: string
  calendarId: string
}

export type Language = "en" | "zh"

export default function Calendar() {
  const [date, setDate] = useState(new Date())
  const [view, setView] = useState<ViewType>("week")
  const [eventDialogOpen, setEventDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const { events, setEvents } = useCalendar()
  const [searchTerm, setSearchTerm] = useState("")
  const calendarRef = useRef<HTMLDivElement>(null)
  // 使用useLanguage而不是useLocalStorage
  const [language, setLanguage] = useLanguage()
  const t = translations[language]
  const [firstDayOfWeek, setFirstDayOfWeek] = useLocalStorage<number>("first-day-of-week", 0) // 0 for Sunday, 1 for Monday, etc.
  const [timezone, setTimezone] = useLocalStorage<string>("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [notificationSound, setNotificationSound] = useLocalStorage<keyof typeof NOTIFICATION_SOUNDS>(
    "notification-sound",
    "telegram",
  )
  const notificationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const notificationsInitializedRef = useRef(false)
  const [previewEvent, setPreviewEvent] = useState<CalendarEvent | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  // 添加一个状态来同步侧边栏日历
  const [sidebarDate, setSidebarDate] = useState<Date>(new Date())

  // 在组件顶部添加一个useEffect来请求权限
  useEffect(() => {
    // 移除自动请求通知权限的功能
    // 不再自动请求通知权限
  }, [])

  // 当主日历日期变化时，同步侧边栏日历
  useEffect(() => {
    setSidebarDate(date)
  }, [date])

  // Initialize notification system
  useEffect(() => {
    if (notificationsInitializedRef.current) return

    console.log("初始化通知系统...")
    notificationsInitializedRef.current = true

    // 检查通知权限状态但不请求
    if (typeof window !== "undefined" && "Notification" in window) {
      console.log("通知权限状态:", Notification.permission)
    }

    // 立即检查一次通知
    checkPendingNotifications()

    // Schedule notifications for all future events
    for (const event of events) {
      const eventTime = new Date(event.startDate).getTime()
      const now = Date.now()

      // 确保包括notification为0的事件（事件开始时通知）
      if (eventTime > now) {
        scheduleEventNotification(event, event.notification, notificationSound)
      }
    }

    // Set up an interval to check for pending notifications
    const intervalId = setInterval(() => {
      console.log("定时检查通知...")
      checkPendingNotifications()
    }, 15000) // Check every 15 seconds

    notificationIntervalRef.current = intervalId

    return () => {
      if (notificationIntervalRef.current) {
        clearInterval(notificationIntervalRef.current)
        notificationIntervalRef.current = null
      }
      clearAllNotificationTimers()
    }
  }, [events, notificationSound])

  // 添加监听预览事件的处理函数
  useEffect(() => {
    const handlePreviewEvent = (e: CustomEvent) => {
      const eventId = e.detail.eventId
      const event = events.find((e) => e.id === eventId)
      if (event) {
        setPreviewEvent(event)
        setPreviewOpen(true)
      }
    }

    window.addEventListener("preview-event", handlePreviewEvent as EventListener)

    return () => {
      window.removeEventListener("preview-event", handlePreviewEvent as EventListener)
    }
  }, [events])

  // Listen for view-event custom event
  useEffect(() => {
    const handleViewEvent = (e: CustomEvent) => {
      const eventId = e.detail.eventId
      const event = events.find((e) => e.id === eventId)
      if (event) {
        setSelectedEvent(event)
        setEventDialogOpen(true)
      }
    }

    window.addEventListener("view-event", handleViewEvent as EventListener)

    return () => {
      window.removeEventListener("view-event", handleViewEvent as EventListener)
    }
  }, [events])

  useEffect(() => {
    scrollToCurrentTime()
  }, [])

  const scrollToCurrentTime = () => {
    if (calendarRef.current) {
      const now = new Date()
      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()
      const currentPosition = currentHour * 60 + currentMinute

      // Calculate the container height
      const containerHeight = calendarRef.current.clientHeight

      // Calculate the ideal scroll position (centered on red line)
      let scrollPosition = currentPosition - containerHeight / 2

      // Ensure we don't scroll past the bottom
      const maxScrollPosition = 24 * 60 - containerHeight

      // Ensure we don't scroll above the top
      scrollPosition = Math.max(0, Math.min(scrollPosition, maxScrollPosition))

      calendarRef.current.scrollTop = scrollPosition
    }
  }

  const handlePrevious = () => {
    setDate((prev) => {
      switch (view) {
        case "day":
          return subDays(prev, 1)
        case "week":
          return subDays(prev, 7)
        case "month":
          return new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
        default:
          return prev
      }
    })
  }

  const handleNext = () => {
    setDate((prev) => {
      switch (view) {
        case "day":
          return addDays(prev, 1)
        case "week":
          return addDays(prev, 7)
        case "month":
          return new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
        default:
          return prev
      }
    })
  }

  const handleEventAdd = async (event: CalendarEvent) => {
    setEvents([...events, event])
    setEventDialogOpen(false)

    // 仍然调度通知，但不显示 toast
    scheduleEventNotification(event, event.notification, notificationSound)
  }

  const handleEventUpdate = async (updatedEvent: CalendarEvent) => {
    setEvents(events.map((event) => (event.id === updatedEvent.id ? updatedEvent : event)))
    setEventDialogOpen(false)
    setSelectedEvent(null)

    // 仍然调度通知，但不显示 toast
    scheduleEventNotification(updatedEvent, updatedEvent.notification, notificationSound)
  }

  const handleEventDelete = (eventId: string) => {
    setEvents(events.filter((event) => event.id !== eventId))
    setEventDialogOpen(false)
    setSelectedEvent(null)

    // Remove any scheduled notifications for this event
    const notifications = JSON.parse(localStorage.getItem("scheduled-notifications") || "[]")
    const updatedNotifications = notifications.filter((n: any) => n.id !== eventId)
    localStorage.setItem("scheduled-notifications", JSON.stringify(updatedNotifications))
  }

  const handleImportEvents = (importedEvents: CalendarEvent[]) => {
    // 确保导入的事件有正确的日期格式
    const processedEvents = importedEvents.map((event) => ({
      ...event,
      // 确保日期是Date对象
      startDate: event.startDate instanceof Date ? event.startDate : new Date(event.startDate),
      endDate: event.endDate instanceof Date ? event.endDate : new Date(event.endDate),
      // 确保有ID
      id: event.id || Date.now().toString() + Math.random().toString(36).substring(2, 9),
      // 确保有日历ID
      calendarId: event.calendarId || "1",
      // 确保有颜色
      color: event.color || "bg-blue-500",
      // 确保有参与者数组
      participants: Array.isArray(event.participants) ? event.participants : [],
      // 确保有通知设置
      notification: typeof event.notification === "number" ? event.notification : 0,
      // 确保有重复设置
      recurrence: event.recurrence || "none",
    }))

    // 检查每个导入的事件，确保它不与现有事件重复
    const newEvents = processedEvents.filter((importedEvent) => {
      return !events.some(
        (existingEvent) =>
          existingEvent.id === importedEvent.id ||
          (existingEvent.title === importedEvent.title &&
            new Date(existingEvent.startDate).getTime() === new Date(importedEvent.startDate).getTime()),
      )
    })

    if (newEvents.length > 0) {
      setEvents([...events, ...newEvents])

      // 为新导入的事件设置通知
      for (const event of newEvents) {
        const eventTime = new Date(event.startDate).getTime()
        const now = Date.now()

        if (eventTime > now) {
          scheduleEventNotification(event, event.notification, notificationSound)
        }
      }

      toast({
        title: language === "en" ? "Import Successful" : "导入成功",
        description:
          language === "en"
            ? `Successfully imported ${newEvents.length} events`
            : `成功导入 ${newEvents.length} 个事件`,
      })
    } else {
      toast({
        title: language === "en" ? "Import Notice" : "导入注意",
        description:
          language === "en" ? "No new events found or all events already exist" : "没有发现新的事件或所有事件已存在",
      })
    }
  }

  // Update handleEventClick to show preview instead of edit dialog
  const handleEventClick = (event: CalendarEvent) => {
    setPreviewEvent(event)
    setPreviewOpen(true)
  }

  // Add handler for edit button in preview
  const handleEventEdit = () => {
    setSelectedEvent(previewEvent)
    setEventDialogOpen(true)
    setPreviewOpen(false)
  }

  // Add handler for duplicate button in preview
  const handleEventDuplicate = () => {
    if (previewEvent) {
      const newEvent = {
        ...previewEvent,
        id: Date.now().toString(),
        title: `${previewEvent.title} (${t.copy || "Copy"})`,
      }
      setEvents([...events, newEvent])
      toast({
        title: t.eventDuplicated || "Event duplicated",
        description: newEvent.title,
      })
    }
  }

  const handleTodayClick = () => {
    const today = startOfToday()
    if (view === "analytics") {
      setView("week")
    }
    setDate(today)
    setSidebarDate(today) // 同步侧边栏日历
    scrollToCurrentTime()
  }

  const handleDateSelect = (selectedDate: Date) => {
    setDate(selectedDate)
  }

  const handleViewChange = (newView: string) => {
    if (newView === "analytics") {
      setView("analytics")
    }
  }

  const handleCreateFromSuggestion = (startDate: Date, endDate: Date) => {
    setSelectedEvent(null)
    const newEvent: Partial<CalendarEvent> = {
      startDate,
      endDate,
    }
    // 预填充事件对话框
    setSelectedEvent(newEvent as any)
    setEventDialogOpen(true)
  }

  const filteredEvents = events.filter(
    (event) =>
      event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.description?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const formatDateDisplay = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: timezone,
    }
    return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", options).format(date)
  }

  return (
    <div className="flex h-screen bg-background">
      <div className="w-80 border-r bg-background">
        <Sidebar
          onCreateEvent={() => setEventDialogOpen(true)}
          onDateSelect={handleDateSelect}
          onViewChange={handleViewChange}
          language={language}
          selectedDate={sidebarDate} // 传递同步的日期给侧边栏
        />
      </div>

      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between px-4 h-16 border-b">
          <div className="flex items-center space-x-4">
            <CalendarIcon className="h-8 w-8 text-blue-500" />
            <h1 className="text-xl font-semibold">{t.calendar}</h1>
            <Button variant="outline" size="sm" onClick={handleTodayClick}>
              {t.today || "今天"}
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            {view !== "analytics" && (
              <>
                <div className="flex items-center space-x-1">
                  <Button variant="ghost" size="icon" onClick={handlePrevious}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleNext}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <span className="text-lg">{formatDateDisplay(date)}</span>
              </>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Select value={view} onValueChange={(value: ViewType) => setView(value)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">{t.day}</SelectItem>
                <SelectItem value="week">{t.week}</SelectItem>
                <SelectItem value="month">{t.month}</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="h-5 w-5 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder={t.searchEvents}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 w-48"
              />
              {searchTerm && (
                <div className="absolute z-10 mt-2 w-full bg-white border border-gray-200 rounded-md shadow-lg">
                  {filteredEvents.map((event) => (
                    <div
                      key={event.id}
                      className="p-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => {
                        setPreviewEvent(event)
                        setPreviewOpen(true)
                        setSearchTerm("")
                      }}
                    >
                      <div className="font-medium">{event.title}</div>
                      <div className="text-sm text-gray-500">{formatDateDisplay(new Date(event.startDate))}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Settings
              language={language}
              setLanguage={setLanguage}
              firstDayOfWeek={firstDayOfWeek}
              setFirstDayOfWeek={setFirstDayOfWeek}
              timezone={timezone}
              setTimezone={setTimezone}
              notificationSound={notificationSound}
              setNotificationSound={setNotificationSound}
            />
          </div>
        </header>

        <div className="flex-1 overflow-auto" ref={calendarRef}>
          {view === "day" && (
            <DayView
              date={date}
              events={filteredEvents}
              onEventClick={handleEventClick}
              language={language}
              timezone={timezone}
            />
          )}
          {view === "week" && (
            <WeekView
              date={date}
              events={filteredEvents}
              onEventClick={handleEventClick}
              language={language}
              firstDayOfWeek={firstDayOfWeek}
              timezone={timezone}
            />
          )}
          {view === "month" && (
            <MonthView
              date={date}
              events={filteredEvents}
              onEventClick={handleEventClick}
              language={language}
              firstDayOfWeek={firstDayOfWeek}
              timezone={timezone}
            />
          )}
          {view === "analytics" && (
            <AnalyticsView
              events={events}
              onCreateEvent={handleCreateFromSuggestion}
              onImportEvents={handleImportEvents}
            />
          )}
        </div>
      </div>

      <EventPreview
        event={previewEvent}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onEdit={handleEventEdit}
        onDelete={() => {
          if (previewEvent) {
            handleEventDelete(previewEvent.id)
            setPreviewOpen(false)
          }
        }}
        onDuplicate={handleEventDuplicate}
        language={language}
        timezone={timezone}
      />

      <EventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        onEventAdd={handleEventAdd}
        onEventUpdate={handleEventUpdate}
        onEventDelete={handleEventDelete}
        initialDate={date}
        event={selectedEvent}
        language={language}
        timezone={timezone}
      />

      <Suspense fallback={null}>
        <EventUrlHandler />
      </Suspense>
    </div>
  )
}

