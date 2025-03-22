"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { CalendarIcon, ChevronLeft, ChevronRight, Search } from "lucide-react"
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
  const { events, setEvents } = useCalendar()
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

  const handleDateSelect = (date: Date) => {
    setDate(date)
    setSidebarDate(date)
  }

  const handleViewChange = (newView: ViewType) => {
    setView(newView)
  }

  const handleTodayClick = () => {
    setDate(new Date())
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
    setSelectedEvent(event)
    setEventDialogOpen(true)
  }

  const handleEventAdd = (event: CalendarEvent) => {
    setEvents((prevEvents) => [...prevEvents, event])
    setEventDialogOpen(false)
    setSelectedEvent(null) // 重置选中的事件
  }

  const handleEventUpdate = (updatedEvent: CalendarEvent) => {
    setEvents((prevEvents) => prevEvents.map((event) => (event.id === updatedEvent.id ? updatedEvent : event)))
    setEventDialogOpen(false)
    setSelectedEvent(null) // 重置选中的事件
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

  const handleEventEdit = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setEventDialogOpen(true)
    setPreviewOpen(false)
  }

  const handleEventDuplicate = (event: CalendarEvent) => {
    const duplicatedEvent = { ...event, id: Math.random().toString(36).substring(7) }
    setEvents((prevEvents) => [...prevEvents, duplicatedEvent])
    setPreviewOpen(false)
  }

  // 新增：处理时间格子点击事件
  const handleTimeSlotClick = (clickTime: Date) => {
    // 设置开始时间为点击的时间
    setQuickCreateStartTime(clickTime)

    // 创建一个新的空事件，设置开始和结束时间
    const endTime = new Date(clickTime.getTime() + 30 * 60000) // 30分钟后

    const newEvent: CalendarEvent = {
      id: Math.random().toString(36).substring(7),
      title: "",
      startDate: clickTime,
      endDate: endTime,
      isAllDay: false,
      recurrence: "none",
      participants: [],
      notification: 15, // 默认提前15分钟通知
      color: "bg-blue-500",
      calendarId: "1", // 默认日历
    }

    setSelectedEvent(newEvent)

    // 打开事件对话框
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

  // 修改return部分，将RightSidebar集成到布局中
  return (
    <div className="flex h-screen bg-background">
      <div className="w-80 border-r bg-background">
        <Sidebar
          onCreateEvent={() => setEventDialogOpen(true)}
          onDateSelect={handleDateSelect}
          onViewChange={handleViewChange}
          language={language}
          selectedDate={sidebarDate}
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
                <SelectItem value="analytics">{t.analytics}</SelectItem>
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
                  <ScrollArea className="max-h-[300px]">
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
                  </ScrollArea>
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
                setSelectedEvent({
                  id: Math.random().toString(36).substring(7),
                  title: "",
                  startDate,
                  endDate,
                  isAllDay: false,
                  recurrence: "none",
                  participants: [],
                  notification: 15,
                  color: "bg-blue-500",
                  calendarId: "1",
                })
                setEventDialogOpen(true)
              }}
              onImportEvents={handleImportEvents}
            />
          )}
        </div>
      </div>

      {/* 右侧边栏 */}
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

