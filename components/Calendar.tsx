"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { CalendarIcon, ChevronLeft, ChevronRight, Menu, Search, Moon, Sun } from "lucide-react"
import { format, addDays, subDays, startOfToday } from "date-fns"
import { zhCN } from "date-fns/locale"
import Sidebar, { type CalendarCategory } from "./Sidebar"
import DayView from "./DayView"
import WeekView from "./WeekView"
import MonthView from "./MonthView"
import EventDialog from "./EventDialog"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import { useTheme } from "next-themes"

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
  const [sidebarOpen, setSidebarOpen] = useState(true)
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

  useEffect(() => {
    scrollToCurrentTime()
  }, [])

  const scrollToCurrentTime = () => {
    if (calendarRef.current) {
      const now = new Date()
      const scrollPosition = now.getHours() * 60 + now.getMinutes() - 120 // Scroll to 2 hours before current time
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

  const handleEventAdd = (event: CalendarEvent) => {
    setEvents((prev) => [...prev, event])
    setEventDialogOpen(false)
  }

  const handleEventUpdate = (updatedEvent: CalendarEvent) => {
    setEvents((prev) => prev.map((event) => (event.id === updatedEvent.id ? updatedEvent : event)))
    setEventDialogOpen(false)
    setSelectedEvent(null)
  }

  const handleEventDelete = (eventId: string) => {
    setEvents((prev) => prev.filter((event) => event.id !== eventId))
    setEventDialogOpen(false)
    setSelectedEvent(null)
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

  return (
    <div className="flex h-screen bg-background">
      <Sidebar open={sidebarOpen} onCreateEvent={() => setEventDialogOpen(true)} onDateSelect={handleDateSelect} />

      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between px-4 h-16 border-b">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="h-5 w-5" />
            </Button>
            <CalendarIcon className="h-8 w-8 text-blue-500" />
            <h1 className="text-xl font-semibold cursor-pointer" onClick={handleTodayClick}>
              日历
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
            <span className="text-lg">{format(date, "yyyy年MM月d日", { locale: zhCN })}</span>
          </div>

          <div className="flex items-center space-x-2">
            <Select value={view} onValueChange={(value: ViewType) => setView(value)}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">日</SelectItem>
                <SelectItem value="week">周</SelectItem>
                <SelectItem value="month">月</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="h-5 w-5 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="搜索日程"
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
                        {format(new Date(event.startDate), "yyyy-MM-dd HH:mm")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto" ref={calendarRef}>
          {view === "day" && <DayView date={date} events={filteredEvents} onEventClick={handleEventClick} />}
          {view === "week" && <WeekView date={date} events={filteredEvents} onEventClick={handleEventClick} />}
          {view === "month" && <MonthView date={date} events={filteredEvents} onEventClick={handleEventClick} />}
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
      />
    </div>
  )
}
