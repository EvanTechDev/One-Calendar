"use client"

import { useState, useEffect, useRef, Suspense, useLayoutEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { ChevronLeft, ChevronRight, Search, PanelLeft, BarChart2, Settings as SettingsIcon } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { addDays, subDays } from "date-fns"
import Sidebar from "@/components/sidebar/Sidebar"
import DayView from "@/components/view/DayView"
import WeekView from "@/components/view/WeekView"
import MonthView from "@/components/view/MonthView"
import EventDialog from "@/components/event/EventDialog"
import Settings from "@/components/home/Settings"
import UserProfileButton, { type UserProfileSection } from "@/components/home/UserProfileButton"
import { translations, useLanguage } from "@/lib/i18n"
import { checkPendingNotifications, clearAllNotificationTimers, type NOTIFICATION_SOUNDS } from "@/lib/notifications"
import EventPreview from "@/components/event/EventPreview"
import { readEncryptedLocalStorage, useLocalStorage, writeEncryptedLocalStorage } from "@/hooks/useLocalStorage"
import { useCalendar } from "@/components/context/CalendarContext"
import EventUrlHandler from "@/components/event/EventUrlHandler"
import RightSidebar from "@/components/sidebar/RightSidebar"
import AnalyticsView from "@/components/analytics/AnalyticsView"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import DailyToast from "@/components/home/DailyToast"
import { toast } from "sonner"
import { useTheme } from "next-themes"

type ViewType = "day" | "week" | "month" | "analytics" | "settings"

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


export default function Calendar({ className, ...props }: CalendarProps) {
  const [openShareImmediately, setOpenShareImmediately] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [date, setDate] = useState(new Date())
  const [view, setView] = useState<ViewType>("week")
  const [eventDialogOpen, setEventDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const { events, setEvents, calendars } = useCalendar()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategoryFilters, setSelectedCategoryFilters] = useState<string[]>([])
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
  const [focusUserProfileSection, setFocusUserProfileSection] = useState<UserProfileSection | null>(null)
  const [sidebarDate, setSidebarDate] = useState<Date>(new Date())
  const { theme } = useTheme()

  useLayoutEffect(() => {
    const body = document.body
    const colorThemes = ['blue', 'green', 'purple', 'orange', 'azalea', 'pink', 'crimson']

    body.classList.add('app')

    colorThemes.forEach(color => body.classList.remove(color))
    
    if (theme && colorThemes.includes(theme)) {
      body.classList.add(theme)
    }

    return () => {
      body.classList.remove('app')
      colorThemes.forEach(color => body.classList.remove(color))
    }
  }, [theme])
  
  const updateEvent = (updatedEvent) => {
    setEvents(prevEvents => 
      prevEvents.map(event => 
        event.id === updatedEvent.id ? updatedEvent : event
      )
    )
  }
  
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

  const handleUserProfileSectionNavigate = (section: UserProfileSection) => {
    setView("settings")
    setFocusUserProfileSection(null)
    setTimeout(() => setFocusUserProfileSection(section), 0)
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
      const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long" }
      return date.toLocaleDateString(language, options)
    } else {
      const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long" }
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

  const handleImportEvents = (importedEvents: CalendarEvent[]) => {
    const newEvents = importedEvents.map((event) => ({
      ...event,
      id: event.id || Math.random().toString(36).substring(7),
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

  // 收藏（书签）功能
  const toggleBookmark = async (event: CalendarEvent) => {
    const bookmarks = await readEncryptedLocalStorage<any[]>("bookmarked-events", [])

    const isBookmarked = bookmarks.some((b: any) => b.id === event.id)
    if (isBookmarked) {
      const updated = bookmarks.filter((b: any) => b.id !== event.id)
      await writeEncryptedLocalStorage("bookmarked-events", updated)
    } else {
      const bookmarkData = {
        id: event.id,
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        color: event.color,
        location: event.location,
        bookmarkedAt: new Date().toISOString(),
      }
      await writeEncryptedLocalStorage("bookmarked-events", [...bookmarks, bookmarkData])
    }
  }

  const handleShare = (event: CalendarEvent) => {
    setPreviewEvent(event)
    setPreviewOpen(true)
  }


  const eventsByCategory = useMemo(() => {
    if (selectedCategoryFilters.length === 0) return events

    return events.filter((event) => {
      if (!event.calendarId) {
        return selectedCategoryFilters.includes("__uncategorized__")
      }

      const hasCategory = calendars.some((cal) => cal.id === event.calendarId)
      if (!hasCategory) return selectedCategoryFilters.includes("__uncategorized__")
      return selectedCategoryFilters.includes(event.calendarId)
    })
  }, [events, selectedCategoryFilters, calendars])

  const filteredEvents = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    if (!keyword) return eventsByCategory

    return eventsByCategory
      .filter((event) => {
        const title = event.title?.toLowerCase() || ""
        const location = event.location?.toLowerCase() || ""
        const description = event.description?.toLowerCase() || ""
        return title.includes(keyword) || location.includes(keyword) || description.includes(keyword)
      })
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
  }, [eventsByCategory, searchTerm])

  const searchResultEvents = useMemo(() => {
    if (!searchTerm.trim()) return []
    return filteredEvents.slice(0, 8)
  }, [filteredEvents, searchTerm])

  useEffect(() => {
    if (!notificationsInitializedRef.current) {
      checkPendingNotifications(notificationSound)
      notificationsInitializedRef.current = true
    }

    if (!notificationIntervalRef.current) {
      notificationIntervalRef.current = setInterval(() => {
        checkPendingNotifications(notificationSound)
      }, 60000)
    }

    return () => {
      if (notificationIntervalRef.current) {
        clearInterval(notificationIntervalRef.current)
      }
    }
  }, [notificationSound])

  useEffect(() => {
    window.addEventListener("beforeunload", clearAllNotificationTimers)
    return () => {
      window.removeEventListener("beforeunload", clearAllNotificationTimers)
    }
  }, [])

  return (
    <div className={className}>
    <div className="relative flex h-dvh overflow-hidden bg-background">
      {/* <div className="w-80 border-r bg-background"> */}
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
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          selectedCategoryFilters={selectedCategoryFilters}
          onCategoryFilterChange={(categoryId, checked) => {
            setSelectedCategoryFilters((prev) => {
              if (checked) {
                return prev.includes(categoryId) ? prev : [...prev, categoryId]
              }
              return prev.filter((id) => id !== categoryId)
            })
          }}
        />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col pr-14">
        {" "}
        <header className="flex items-center justify-between px-4 h-16 border-b relative z-40 bg-background">
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              size="sm"
            >
              <PanelLeft />
            </Button>
            <Button variant="outline" size="sm" onClick={handleTodayClick}>
              {t.today || "今天"}
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            {view !== "analytics" && view !== "settings" && (
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
              <Select value={view === "day" || view === "week" || view === "month" ? view : defaultView === "day" || defaultView === "week" || defaultView === "month" ? defaultView : "week"} onValueChange={(value: ViewType) => setView(value)}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="day">{t.day}</SelectItem>
                    <SelectItem value="week">{t.week}</SelectItem>
                    <SelectItem value="month">{t.month}</SelectItem>

                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <DropdownMenu open={!!searchTerm}>
              <DropdownMenuTrigger asChild>
                <div className="relative z-50">
                  <Search className="h-5 w-5 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <Input
                    type="text"
                    placeholder={t.searchEvents}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && searchResultEvents.length > 0) {
                        setPreviewEvent(searchResultEvents[0])
                        setPreviewOpen(true)
                        setSearchTerm("")
                      }
                    }}
                    className="pl-9 pr-4 py-2 w-48"
                  />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 p-1">
                {searchResultEvents.length > 0 ? (
                  <ScrollArea className="max-h-[320px]">
                    {searchResultEvents.map((event) => (
                      <DropdownMenuItem
                        key={event.id}
                        className="cursor-pointer flex-col items-start gap-1"
                        onClick={() => {
                          setPreviewEvent(event)
                          setPreviewOpen(true)
                          setSearchTerm("")
                        }}
                      >
                        <div className="font-medium leading-none">{event.title || t.unnamedEvent}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateDisplay(new Date(event.startDate))}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </ScrollArea>
                ) : (
                  <DropdownMenuItem disabled>{t.noMatchingEvents}</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full h-8 w-8"
              onClick={() => setView("analytics")}
              aria-label={t.analytics}
            >
              <BarChart2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full h-8 w-8"
              onClick={() => setView("settings")}
              aria-label={t.settings}
            >
              <SettingsIcon className="h-4 w-4" />
            </Button>
            <UserProfileButton
              variant="outline"
              className="rounded-full h-8 w-8"
              onNavigateToSettings={handleUserProfileSectionNavigate}
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
              onEditEvent={handleEventEdit}
              onDeleteEvent={(event) => handleEventDelete(event.id)}
              onShareEvent={(event) => {
                setPreviewEvent(event)
                setPreviewOpen(true)
                setOpenShareImmediately(true)}}
              onBookmarkEvent={toggleBookmark}
              onEventDrop={(event, newStartDate, newEndDate) => {
                const updatedEvent = {
                  ...event,
                  startDate: newStartDate,
                  endDate: newEndDate
                }

                updateEvent(updatedEvent)
              }}
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
              onEditEvent={handleEventEdit}
              onDeleteEvent={(event) => handleEventDelete(event.id)}
              onShareEvent={(event) => {
                setPreviewEvent(event)
                setPreviewOpen(true)
                setOpenShareImmediately(true)}}
              onBookmarkEvent={toggleBookmark}
              onEventDrop={(event, newStartDate, newEndDate) => {
                const updatedEvent = {
                  ...event,
                  startDate: newStartDate,
                  endDate: newEndDate
                }

                updateEvent(updatedEvent)
              }}
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
            />
          )}
          {view === "settings" && (
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
              events={events}
              onImportEvents={handleImportEvents}
              focusUserProfileSection={focusUserProfileSection}
            />
          )}
        </div>
      </div>

      {/* 右侧边栏 - 现在从顶部栏下方开始 */}
      <RightSidebar onViewChange={handleViewChange} onEventClick={handleEventClick} />

      {/* 保持原有的对话框和其他组件不变 */}
      <EventPreview
        event={previewEvent}
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open)
          if (!open) setOpenShareImmediately(false)
        }}
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
        openShareImmediately={openShareImmediately}
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

      <DailyToast />
    </div>
    </div>
  )
}
