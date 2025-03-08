"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { CalendarIcon, ChevronLeft, ChevronRight, Search, Moon, Sun } from "lucide-react"
import { addDays, subDays, startOfToday } from "date-fns"
import Sidebar, { type CalendarCategory } from "./Sidebar"
import DayView from "./DayView"
import WeekView from "./WeekView"
import MonthView from "./MonthView"
import EventDialog from "./EventDialog"
import Settings from "./Settings"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import { useTheme } from "next-themes"
import { useLanguage, translations } from "@/lib/i18n"
import {
  scheduleEventNotification,
  checkPendingNotifications,
  clearAllNotificationTimers,
  type NOTIFICATION_SOUNDS,
} from "@/utils/notifications"
import { toast } from "@/components/ui/use-toast"
// 导入通知权限请求函数
import { requestNotificationPermission } from "@/utils/notification-permission"

type ViewType = "day" | "week" | "month"

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

export default function Calendar() {
  const [date, setDate] = useState(new Date())
  const [view, setView] = useState<ViewType>("week")
  const [eventDialogOpen, setEventDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [events, setEvents] = useLocalStorage<CalendarEvent[]>("calendar-events", [])
  const [calendars] = useLocalStorage<CalendarCategory[]>("calendar-categories", [
    { id: "1", name: "Personal", color: "bg-blue-500" },
    { id: "2", name: "Work", color: "bg-green-500" },
    { id: "3", name: "Family", color: "bg-yellow-500" },
  ])
  const [searchTerm, setSearchTerm] = useState("")
  const { theme, setTheme } = useTheme()
  const calendarRef = useRef<HTMLDivElement>(null)
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

  // 在组件顶部添加一个useEffect来请求权限
  useEffect(() => {
    // 请求通知权限
    requestNotificationPermission().then((granted) => {
      if (granted) {
        console.log("通知权限已授予")
      } else {
        console.log("通知权限被拒绝")
        // 显示一个提示，告诉用户启用通知的好处
        toast({
          title: "通知权限",
          description: "启用通知可以帮助您不错过重要事件。您可以在浏览器设置中更改此权限。",
          duration: 8000,
        })
      }
    })
  }, [])

  // Initialize notification system
  useEffect(() => {
    if (notificationsInitializedRef.current) return

    console.log("初始化通知系统...")
    notificationsInitializedRef.current = true

    // 请求通知权限
    if (typeof window !== "undefined" && "Notification" in window) {
      Notification.requestPermission().then((permission) => {
        console.log("通知权限状态:", permission)
      })
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
    setEvents((prev) => [...prev, event])
    setEventDialogOpen(false)

    // Schedule notification for the event
    // 确保包括notification为0的事件（事件开始时通知）
    scheduleEventNotification(event, event.notification, notificationSound)

    // Show a toast confirmation
    const notificationMessage =
      event.notification === 0 ? "将在事件开始时提醒您" : `将在事件开始前 ${event.notification} 分钟提醒您`

    console.log("Showing toast notification:", notificationMessage)

    // Try showing a test toast directly
    toast({
      title: "测试通知",
      description: "这是一个测试通知，检查toast是否正常工作",
      duration: 5000,
    })

    toast({
      title: "提醒已设置",
      description: notificationMessage,
      duration: 3000,
    })
  }

  const handleEventUpdate = async (updatedEvent: CalendarEvent) => {
    setEvents((prev) => prev.map((event) => (event.id === updatedEvent.id ? updatedEvent : event)))
    setEventDialogOpen(false)
    setSelectedEvent(null)

    // Schedule notification for the updated event
    // 确保包括notification为0的事件（事件开始时通知）
    scheduleEventNotification(updatedEvent, updatedEvent.notification, notificationSound)

    // Show a toast confirmation
    const notificationMessage =
      updatedEvent.notification === 0
        ? "将在事件开始时提醒您"
        : `将在事件开始前 ${updatedEvent.notification} 分钟提醒您`

    toast({
      title: "提醒已更新",
      description: notificationMessage,
      duration: 3000,
    })
  }

  const handleEventDelete = (eventId: string) => {
    setEvents((prev) => prev.filter((event) => event.id !== eventId))
    setEventDialogOpen(false)
    setSelectedEvent(null)

    // Remove any scheduled notifications for this event
    const notifications = JSON.parse(localStorage.getItem("scheduled-notifications") || "[]")
    const updatedNotifications = notifications.filter((n: any) => n.id !== eventId)
    localStorage.setItem("scheduled-notifications", JSON.stringify(updatedNotifications))
  }

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setEventDialogOpen(true)
  }

  const handleTodayClick = () => {
    setDate(startOfToday())
    scrollToCurrentTime()
  }

  const handleDateSelect = (selectedDate: Date) => {
    setDate(selectedDate)
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
        <Sidebar onCreateEvent={() => setEventDialogOpen(true)} onDateSelect={handleDateSelect} language={language} />
      </div>

      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between px-4 h-16 border-b">
          <div className="flex items-center space-x-4">
            <CalendarIcon className="h-8 w-8 text-blue-500" />
            <h1 className="text-xl font-semibold cursor-pointer" onClick={handleTodayClick}>
              {t.calendar}
            </h1>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <Button variant="ghost" size="icon" onClick={handlePrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <span className="text-lg">{formatDateDisplay(date)}</span>
          </div>

          <div className="flex items-center space-x-2">
            <Select value={view} onValueChange={(value: ViewType) => setView(value)}>
              <SelectTrigger className="w-[100px]">
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
                <div className="absolute z-10 mt-2 w-full bg-white border border-gray-200 rounded-md shadow-lg dark:bg-gray-800 dark:border-gray-700">
                  {filteredEvents.map((event) => (
                    <div
                      key={event.id}
                      className="p-2 hover:bg-gray-100 cursor-pointer dark:hover:bg-gray-700"
                      onClick={() => {
                        setSelectedEvent(event)
                        setEventDialogOpen(true)
                        setSearchTerm("")
                      }}
                    >
                      <div className="font-medium">{event.title}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {formatDateDisplay(new Date(event.startDate))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
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
        </div>
      </div>

      <EventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        onEventAdd={handleEventAdd}
        onEventUpdate={handleEventUpdate}
        onEventDelete={handleEventDelete}
        initialDate={date}
        event={selectedEvent}
        calendars={calendars}
        language={language}
        timezone={timezone}
      />
    </div>
  )
}

