'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addMonths, subMonths, startOfToday } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import EventDialog from './EventDialog'
import CalendarView from './CalendarView'

type ViewType = 'day' | 'week' | 'month' | 'year'

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<ViewType>('week')
  const [events, setEvents] = useLocalStorage<CalendarEvent[]>('calendar-events', [])
  const [showEventDialog, setShowEventDialog] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission()
    }

    const checkNotifications = setInterval(() => {
      const now = new Date()
      events.forEach(event => {
        const eventStart = new Date(event.startDate)
        const notificationTime = new Date(eventStart.getTime() - event.notification * 60000)
        
        if (Math.abs(now.getTime() - notificationTime.getTime()) < 30000) {
          if (Notification.permission === 'granted') {
            new Notification(event.title, {
              body: `${event.description || ''}\n地点: ${event.location || '未设置'}\n开始时间: ${format(eventStart, 'HH:mm')}`,
            })
          }
        }
      })
    }, 30000)

    return () => clearInterval(checkNotifications)
  }, [events])

  const handlePrevious = () => {
    setCurrentDate(prev => {
      switch (view) {
        case 'day':
          return new Date(prev.setDate(prev.getDate() - 1))
        case 'week':
          return new Date(prev.setDate(prev.getDate() - 7))
        case 'month':
          return subMonths(prev, 1)
        case 'year':
          return new Date(prev.setFullYear(prev.getFullYear() - 1))
        default:
          return prev
      }
    })
  }

  const handleNext = () => {
    setCurrentDate(prev => {
      switch (view) {
        case 'day':
          return new Date(prev.setDate(prev.getDate() + 1))
        case 'week':
          return new Date(prev.setDate(prev.getDate() + 7))
        case 'month':
          return addMonths(prev, 1)
        case 'year':
          return new Date(prev.setFullYear(prev.getFullYear() + 1))
        default:
          return prev
      }
    })
  }

  const handleToday = () => {
    setCurrentDate(startOfToday())
  }

  const handleTimeSlotClick = (date: Date) => {
    setSelectedSlot(date)
    setSelectedEvent(null)
    setShowEventDialog(true)
  }

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setSelectedSlot(new Date(event.startDate))
    setShowEventDialog(true)
  }

  const handleEventAdd = (event: CalendarEvent) => {
    setEvents(prev => [...prev, event])
    setShowEventDialog(false)
  }

  const handleEventUpdate = (updatedEvent: CalendarEvent) => {
    setEvents(prev => prev.map(event => 
      event.id === updatedEvent.id ? updatedEvent : event
    ))
    setShowEventDialog(false)
  }

  const handleEventDelete = (eventId: string) => {
    setEvents(prev => prev.filter(event => event.id !== eventId))
    setShowEventDialog(false)
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={handleToday}>今天</Button>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" onClick={handlePrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-lg font-medium">
              {format(currentDate, view === 'year' ? 'yyyy年' : 'yyyy年 MM月', { locale: zhCN })}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={view} onValueChange={(value: ViewType) => setView(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">日视图</SelectItem>
              <SelectItem value="week">周视图</SelectItem>
              <SelectItem value="month">月视图</SelectItem>
              <SelectItem value="year">年视图</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <CalendarView
          view={view}
          currentDate={currentDate}
          events={events}
          onTimeSlotClick={handleTimeSlotClick}
          onEventClick={handleEventClick}
        />
      </main>

      <EventDialog
        open={showEventDialog}
        onOpenChange={setShowEventDialog}
        onEventAdd={handleEventAdd}
        onEventUpdate={handleEventUpdate}
        onEventDelete={handleEventDelete}
        initialDate={selectedSlot}
        event={selectedEvent}
      />
    </div>
  )
}
