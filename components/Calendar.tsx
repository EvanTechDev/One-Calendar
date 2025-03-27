"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { addDays, subDays } from "date-fns"
import Sidebar from "./Sidebar"
import DayView from "./DayView"
import WeekView from "./WeekView"
import MonthView from "./MonthView"
import EventDialog from "./EventDialog"
import Settings from "./Settings"
import { translations, useLanguage } from "@/lib/i18n"
import { checkPendingNotifications, clearAllNotificationTimers, type NOTIFICATION_SOUNDS } from "@/utils/notifications"
import EventPreview from "./EventPreview"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import { useCalendar } from "@/contexts/CalendarContext"
import EventUrlHandler from "./EventUrlHandler"
import RightSidebar from "./RightSidebar"
import AnalyticsView from "./AnalyticsView"
import { ScrollArea } from "@/components/ui/scroll-area"

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
  // 保持所有现有状态和函数不变
  const [date, setDate] = useState(new Date())
  const [view, setView] = useState<ViewType>("week")
  const [eventDialogOpen, setEventDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const { events, setEvents, calendars } = useCalendar()
  const [searchTerm, setSearchTerm] = useState("")
  const calendarRef = useRef<HTMLDivElement>(null)
  const [language, setLanguage] = useLanguage()
  const t = translations[language]
  const [firstDayOfWeek, setFirstDayOfWeek] = useLocalStorage<number>("first-day-of-week", 0)
  const [timezone, setTimezone] = useLocalStorage<string>("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [notificationSound, setNotificationSound] = useLocalStorage<keyof typeof NOTIFICATION_SOUNDS>(
    "notification-sound",
    "telegram",
  )
  const notificationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const notificationsInitializedRef = useRef(false)
  const [previewEvent, setPreviewEvent] = useState<CalendarEvent | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [sidebarDate, setSidebarDate] = useState<Date>(new Date())

  // 新增：快速创建事件的初始时间
  const [quickCreateStartTime, setQuickCreateStartTime] = useState<Date | null>(null)

  // Add the new state variables for default view and keyboard shortcuts
  const [defaultView, setDefaultView] = useLocalStorage<ViewType>("default-view", "week")
  const [enableShortcuts, setEnableShortcuts] = useLocalStorage<boolean>("enable-shortcuts", true)

  // Add a useEffect to set the initial view based on the default view setting
  useEffect(() => {
    // Only set the view on initial load
    if (view !== defaultView) {
      setView(defaultView as ViewType)
    }
  }, [])

  // Add the keyboard shortcut handler
  useEffect(() => {
    if (!enableShortcuts) return // Early return if shortcuts are disabled

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input, textarea, or contentEditable element
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement?.getAttribute("contenteditable") === "true"
      ) {
        return
      }

      switch (e.key) {
        case "n":
        case "N":
          e.preventDefault()
          setSelectedEvent(null) // 确保是创建新事件
          setQuickCreateStartTime(new Date()) // 使用当前时间
          setEventDialogOpen(true)
          break
        case "/":
          e.preventDefault()
          // Focus the search input
          const searchInput = document.querySelector('input[placeholder="' + t.searchEvents + '"]') as HTMLInputElement
          if (searchInput) {
            searchInput.focus()
          }
          break
        case "t":
        case "T":
          e.preventDefault()
          handleTodayClick()
          break
        case "1":
          e.preventDefault()
          setView("day")
          break
        case "2":
          e.preventDefault()
          setView("week")
          break
        case "3":
          e.preventDefault()
          setView("month")
          break
        case "ArrowRight":
          e.preventDefault()
          handleNext()
          break
        case "ArrowLeft":
          e.preventDefault()
          handlePrevious()
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [enableShortcuts, t.searchEvents]) // Make sure enableShortcuts is in the dependency array

  const handleDateSelect = (date: Date) => {
    setDate(date)
    setSidebarDate(date)
  }

  const handleViewChange = (newView: ViewType) => {
    setView(newView)
  }

  const handleTodayClick = () => {
    const today = new Date()
    setDate(today)
    setSidebarDate(today) // Add this line to update the sidebar calendar
  }

  const handlePrevious = () => {
    setDate((prevDate) => {
      if (view === "day") return subDays(prevDate, 1)
      if (view === "week") return subDays(prevDate, 7)
      return subDays(prevDate, 30)
    })
  }

  const handleNext = () => {
    setDate((prevDate) => {
      if (view === "day") return addDays(prevDate, 1)
      if (view === "week") return addDays(prevDate, 7)
      return addDays(prevDate, 30)
    })
  }

  // 修改：根据语言设置不同的日期格式
  const formatDateDisplay = (date: Date) => {
    if (language === "en") {
      // 英文格式：只显示月和年，不显示日
      const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long" }
      return date.toLocaleDateString(language, options)
    } else {
      // 中文格式：保持原样，显示年月日
      const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" }
      return date.toLocaleDateString(language, options)
    }
  }

  const handleEventClick = (event: CalendarEvent) => {
    setPreviewEvent(event)
    setPreviewOpen(true)
  }

  const handleEventAdd = (event: CalendarEvent) => {
    // Make sure we're adding a new event with the correct ID
    const newEvent = {
      ...event,
      id: event.id || Date.now().toString() + Math.random().toString(36).substring(2, 9),
    }

    setEvents((prevEvents) => [...prevEvents, newEvent])
    setEventDialogOpen(false)
    setSelectedEvent(null)
    setQuickCreateStartTime(null) // Reset the quick create time
  }

  const handleEventUpdate = (updatedEvent: CalendarEvent) => {
    setEvents((prevEvents) => prevEvents.map((event) => (event.id === updatedEvent.id ? updatedEvent : event)))
    setEventDialogOpen(false)
    setSelectedEvent(null)
    setQuickCreateStartTime(null) // Reset the quick create time
  }

  const handleEventDelete = (eventId: string) => {
    setEvents((prevEvents) => prevEvents.filter((event) => event.id !== eventId))
    setEventDialogOpen(false)
    setSelectedEvent(null) // 重置选中的事件
  }

  const handleCreateFromSuggestion = (event: Omit<CalendarEvent, "id">) => {
    const newEvent: CalendarEvent = {
      ...event,
      id: Math.random().toString(36).substring(7),
    }
    setEvents((prevEvents) => [...prevEvents, newEvent])
  }

  const handleImportEvents = (importedEvents: Omit<CalendarEvent, "id">[]) => {
    const newEvents = importedEvents.map((event) => ({
      ...event,
      id: Math.random().toString(36).substring(7),
    })) as CalendarEvent[]
    setEvents((prevEvents) => [...prevEvents, ...newEvents])
  }

  // 修改handleEventEdit函数，确保正确传递事件对象的深拷贝
  const handleEventEdit = () => {
    if (previewEvent) {
      // 使用当前预览的事件
      setSelectedEvent(previewEvent)
      setQuickCreateStartTime(null)
      setEventDialogOpen(true)
      setPreviewOpen(false)
    }
  }

  const handleEventDuplicate = (event: CalendarEvent) => {
    const duplicatedEvent = { ...event, id: Math.random().toString(36).substring(7) }
    setEvents((prevEvents) => [...prevEvents, duplicatedEvent])
    setPreviewOpen(false)
  }

  // 新增：处理时间格子点击事件
  const handleTimeSlotClick = (clickTime: Date) => {
    // 设置快速创建时间
    setQuickCreateStartTime(clickTime)

    // 重要：设置为null表示创建新事件
    setSelectedEvent(null)
    setEventDialogOpen(true)
  }

  const filteredEvents = events.filter((event) => event.title.toLowerCase().includes(searchTerm.toLowerCase()))

  useEffect(() => {
    if (!notificationsInitializedRef.current) {
      checkPendingNotifications()
      notificationsInitializedRef.current = true
    }

    if (!notificationIntervalRef.current) {
      notificationIntervalRef.current = setInterval(() => {
        checkPendingNotifications()
      }, 60000)
    }

    return () => {
      if (notificationIntervalRef.current) {
        clearInterval(notificationIntervalRef.current)
      }
    }
  }, [])

  useEffect(() => {
    window.addEventListener("beforeunload", clearAllNotificationTimers)
    return () => {
      window.removeEventListener("beforeunload", clearAllNotificationTimers)
    }
  }, [])

  // 修改return部分，将RightSidebar集成到布局中，并调整主内容区域的宽度
  return (
    <div className="flex h-screen bg-background">
      <div className="w-80 border-r bg-background">
        <Sidebar
          onCreateEvent={() => {
            setSelectedEvent(null) // 确保是创建新事件
            setQuickCreateStartTime(new Date()) // 使用当前时间
            setEventDialogOpen(true)
          }}
          onDateSelect={handleDateSelect}
          onViewChange={handleViewChange}
          language={language}
          selectedDate={sidebarDate}
        />
      </div>

      {/* 调整主内容区域，减少宽度以适应右侧边栏 */}
      <div className="flex-1 flex flex-col pr-14">
        {" "}
        {/* 添加右侧padding为14，与右侧边栏宽度相同 */}
        <header className="flex items-center justify-between px-4 h-16 border-b relative z-40 bg-background">
          <div className="flex items-center space-x-4">
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
            <div className="relative z-50">
              <Select value={view} onValueChange={(value: ViewType) => setView(value)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">{t.day}</SelectItem>
                  <SelectItem value="week">{t.week}</SelectItem>
                  <SelectItem value="month">{t.month}</SelectItem>
                  <SelectItem value="analytics">{t.analytics}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative z-50">
              <Search className="h-5 w-5 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder={t.searchEvents}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 w-48"
              />
              {searchTerm && (
                <div className="absolute z-50 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg">
                  <ScrollArea className="h-[300px] py-2">
                    {filteredEvents.length > 0 ? (
                      filteredEvents.map((event) => (
                        <div
                          key={event.id}
                          className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                          onClick={() => {
                            setPreviewEvent(event)
                            setPreviewOpen(true)
                            setSearchTerm("")
                          }}
                        >
                          <div className="font-medium">{event.title}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {formatDateDisplay(new Date(event.startDate))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                        {language === "zh" ? "没有找到匹配的事件" : "No matching events found"}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              )}
            </div>
            {/* 将Settings组件放回顶部栏 */}
            <Settings
              language={language}
              setLanguage={setLanguage}
              firstDayOfWeek={firstDayOfWeek}
              setFirstDayOfWeek={setFirstDayOfWeek}
              timezone={timezone}
              setTimezone={setTimezone}
              notificationSound={notificationSound}
              setNotificationSound={setNotificationSound}
              defaultView={defaultView}
              setDefaultView={setDefaultView}
              enableShortcuts={enableShortcuts}
              setEnableShortcuts={setEnableShortcuts}
            />
          </div>
        </header>
        <div className="flex-1 overflow-auto" ref={calendarRef}>
          {view === "day" && (
            <DayView
              date={date}
              events={filteredEvents}
              onEventClick={handleEventClick}
              onTimeSlotClick={handleTimeSlotClick}
              language={language}
              timezone={timezone}
            />
          )}
          {view === "week" && (
            <WeekView
              date={date}
              events={filteredEvents}
              onEventClick={handleEventClick}
              onTimeSlotClick={handleTimeSlotClick}
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
              onCreateEvent={(startDate, endDate) => {
                setSelectedEvent(null) // 确保是创建新事件
                setQuickCreateStartTime(startDate)
                setEventDialogOpen(true)
              }}
              onImportEvents={handleImportEvents}
            />
          )}
        </div>
      </div>

      {/* 右侧边栏 - 现在从顶部栏下方开始 */}
      <RightSidebar onViewChange={handleViewChange} />

      {/* 保持原有的对话框和其他组件不变 */}
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
        initialDate={quickCreateStartTime || date}
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

