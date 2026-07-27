'use client'

import { type NOTIFICATION_SOUNDS } from '@/lib/notifications'
import { getEventAccentColor } from '@/components/app/views/event-colors'
import { useNotifications } from '@/components/app/hooks/useNotifications'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
} from '@zntr/ui/select'
import {
  ChevronLeft,
  ChevronRight,
  Search,
  PanelLeft,
  CircleHelp,
  ShieldCheck,
  MessageSquare,
  FileText,
  ScrollText,
  House,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import UserProfileButton, {
  type UserProfileSection,
} from '@/components/app/profile/user-profile-button'
import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useCalendar } from '@/components/providers/calendar-context'
import {
  useSettings,
  useEvents,
  useBookmarks,
} from '@/components/providers/data-provider'
import { api } from '@/lib/api-client'
import { getValidTimezone } from '@/lib/timezone'
import RightSidebar from '@/components/app/sidebar/right-sidebar'
import { addDays, addYears, subDays, subYears } from 'date-fns'
import EventPreview from '@/components/app/event/event-preview'
import EventDialog from '@/components/app/event/event-dialog'
import { ScrollArea } from '@zntr/ui/scroll-area'
import Sidebar from '@/components/app/sidebar/sidebar'
import { translations, useLanguage } from '@zntr/i18n/calendar'
import { Button } from '@zntr/ui/button'
import { APP_CONFIG } from '@/lib/config'
import {
  CalendarViewType,
  FirstDayOfWeek,
  Language,
  TimeFormat,
  ViewConfig,
  ViewType,
  isCalendarView,
  type CalendarViewTypeValue,
  type FirstDayOfWeekValue,
  type TimeFormatValue,
} from '@/components/app/calendar-types'
import { toast } from 'sonner'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@zntr/ui/input-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@zntr/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@zntr/ui/alert-dialog'

import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth/client'

const loadDayView = () => import('@/components/app/views/day-view')
const loadWeekView = () => import('@/components/app/views/week-view')
const loadMonthView = () => import('@/components/app/views/month-view')
const loadYearView = () => import('@/components/app/views/year-view')
const loadAnalyticsView = () =>
  import('@/components/app/analytics/analytics-view')
const loadSettings = () => import('@/components/app/profile/settings')

const DayView = dynamic(loadDayView)
const WeekView = dynamic(loadWeekView)
const MonthView = dynamic(loadMonthView)
const YearView = dynamic(loadYearView)
const AnalyticsView = dynamic(loadAnalyticsView)
const Settings = dynamic(loadSettings)

export interface CalendarEvent {
  id: string
  title: string
  startDate: Date
  endDate: Date
  isAllDay: boolean
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  location?: string
  participants: string[]
  notification: number
  description?: string
  color: string
  calendarId: string
}

interface CalendarProps {
  className?: string
}

export default function Calendar({ className, ..._props }: CalendarProps) {
  const router = useRouter()
  const [openShareImmediately, setOpenShareImmediately] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isSidebarTransitioning, setIsSidebarTransitioning] = useState(false)
  const [date, setDate] = useState(new Date())
  const [view, setView] = useState<ViewType>('week')
  const [eventDialogOpen, setEventDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const { events, setEvents, calendars } = useCalendar()
  const [searchTerm, setSearchTerm] = useState('')
  const searchInputRef = useRef<HTMLDivElement>(null)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [selectedCategoryFilters, setSelectedCategoryFilters] = useState<
    string[]
  >([])
  const calendarRef = useRef<HTMLDivElement>(null)
  const [language, setLanguage] = useLanguage()
  const t = translations[language]
  const { settings, updateSettings } = useSettings()
  const { upsertEvent, deleteEvent } = useEvents()
  const { deleteBookmarkByEvent } = useBookmarks()
  const [firstDayOfWeek, setFirstDayOfWeek] = useState<FirstDayOfWeekValue>(
    (settings.firstDayOfWeek as FirstDayOfWeekValue) ?? 0,
  )

  const handleFirstDayOfWeekChange = (day: FirstDayOfWeek) => {
    setFirstDayOfWeek(day.value)
    updateSettings({ firstDayOfWeek: day.value })
  }
  const [timezone, setTimezone] = useState<string>(
    getValidTimezone(
      settings.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
  )
  const handleTimezoneChange = (tz: string) => {
    const validTz = getValidTimezone(tz)
    setTimezone(validTz)
    updateSettings({ timezone: validTz })
  }
  const [notificationSound, setNotificationSound] =
    useState<NOTIFICATION_SOUNDS>('telegram')
  const [previewEvent, setPreviewEvent] = useState<CalendarEvent | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewAnchorRect, setPreviewAnchorRect] = useState<DOMRect | null>(
    null,
  )
  const [focusUserProfileSection, setFocusUserProfileSection] =
    useState<UserProfileSection | null>(null)
  const [sidebarDate, setSidebarDate] = useState<Date>(new Date())
  const [pendingDeleteEvent, setPendingDeleteEvent] =
    useState<CalendarEvent | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [shareOnlyMode, setShareOnlyMode] = useState(false)
  const { data: session } = authClient.useSession()
  const isSignedIn = Boolean(session?.user)

  const updateEvent = (updatedEvent: CalendarEvent) => {
    setEvents((prevEvents) =>
      prevEvents.map((event) =>
        event.id === updatedEvent.id ? updatedEvent : event,
      ),
    )
  }

  const handleEventDrop = (
    event: CalendarEvent,
    newStartDate: Date,
    newEndDate: Date,
  ) => {
    const updatedEvent = {
      ...event,
      startDate: newStartDate,
      endDate: newEndDate,
    }
    updateEvent(updatedEvent)
    upsertEvent({
      id: updatedEvent.id,
      title: updatedEvent.title,
      startDate: updatedEvent.startDate.toISOString(),
      endDate: updatedEvent.endDate.toISOString(),
      isAllDay: updatedEvent.isAllDay,
      location: updatedEvent.location || null,
      participants: updatedEvent.participants?.length
        ? updatedEvent.participants.map((p: any) =>
            typeof p === 'string' ? { name: p } : p,
          )
        : null,
      notificationMinutes: updatedEvent.notification || null,
      color: updatedEvent.color || null,
      categoryId: updatedEvent.calendarId || null,
    }).catch(() => {})
  }

  const [quickCreateStartTime, setQuickCreateStartTime] = useState<Date | null>(
    null,
  )
  const [quickCreateEndTime, setQuickCreateEndTime] = useState<Date | null>(
    null,
  )

  const [defaultView, setDefaultView] = useState<CalendarViewTypeValue>(
    (settings.defaultView as CalendarViewTypeValue) ?? 'week',
  )
  const handleDefaultViewChange = (view: CalendarViewTypeValue) => {
    setDefaultView(view)
    updateSettings({ defaultView: view })
  }
  const [enableShortcuts, setEnableShortcuts] = useState<boolean>(
    settings.enableShortcuts ?? true,
  )
  const handleEnableShortcutsChange = (enabled: boolean) => {
    setEnableShortcuts(enabled)
    updateSettings({ enableShortcuts: enabled })
  }
  const [timeFormat, setTimeFormat] = useState<TimeFormatValue>(
    (settings.timeFormat as TimeFormatValue) ?? '24h',
  )
  const handleTimeFormatChange = (format: TimeFormatValue) => {
    setTimeFormat(format)
    updateSettings({ timeFormat: format })
  }
  const [toastPosition, setToastPosition] = useState<
    'bottom-left' | 'bottom-center' | 'bottom-right'
  >(
    (settings.toastPosition as
      | 'bottom-left'
      | 'bottom-center'
      | 'bottom-right') ?? 'bottom-right',
  )
  const handleToastPositionChange = (
    position: 'bottom-left' | 'bottom-center' | 'bottom-right',
  ) => {
    setToastPosition(position)
    updateSettings({ toastPosition: position })
  }

  const firstDayOfWeekObj = useMemo(
    () => FirstDayOfWeek.create(firstDayOfWeek),
    [firstDayOfWeek],
  )
  const timeFormatObj = useMemo(
    () => TimeFormat.create(timeFormat),
    [timeFormat],
  )
  const languageObj = useMemo(() => Language.create(language), [language])

  const viewConfig = useMemo(
    () =>
      ViewConfig.create({
        firstDayOfWeek: firstDayOfWeekObj,
        timezone,
        timeFormat: timeFormatObj,
        language: languageObj,
        date,
        viewType: isCalendarView(view)
          ? CalendarViewType.create(view as CalendarViewTypeValue)
          : undefined,
      }),
    [firstDayOfWeekObj, timezone, timeFormatObj, languageObj, date, view],
  )

  useEffect(() => {
    setView(isCalendarView(defaultView) ? defaultView : 'week')
  }, [defaultView])

  const settingsInitializedRef = useRef(false)

  useEffect(() => {
    if (settingsInitializedRef.current) return
    if (Object.keys(settings).length === 0) return
    settingsInitializedRef.current = true

    const settingsSync: Array<() => void> = [
      () => {
        if (settings.firstDayOfWeek !== undefined)
          setFirstDayOfWeek(settings.firstDayOfWeek as FirstDayOfWeekValue)
      },
      () => {
        if (settings.timezone) setTimezone(getValidTimezone(settings.timezone))
      },
      () => {
        if (settings.defaultView && isCalendarView(settings.defaultView)) {
          setDefaultView(settings.defaultView as CalendarViewTypeValue)
          setView(settings.defaultView as ViewType)
        }
      },
      () => {
        if (settings.enableShortcuts !== undefined)
          setEnableShortcuts(settings.enableShortcuts)
      },
      () => {
        if (settings.timeFormat)
          setTimeFormat(settings.timeFormat as TimeFormatValue)
      },
      () => {
        if (settings.toastPosition)
          setToastPosition(
            settings.toastPosition as
              | 'bottom-left'
              | 'bottom-center'
              | 'bottom-right',
          )
      },
    ]
    settingsSync.forEach((fn) => fn())
  }, [settings])

  useEffect(() => {
    const prefetch = () => {
      void loadDayView()
      void loadWeekView()
      void loadMonthView()
      void loadYearView()
      void loadAnalyticsView()
      void loadSettings()
    }

    if (typeof window === 'undefined') return

    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(prefetch)
      return () => window.cancelIdleCallback(id)
    }

    const timeoutId = globalThis.setTimeout(prefetch, 800)
    return () => globalThis.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    if (!enableShortcuts) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement?.getAttribute('contenteditable') === 'true'
      ) {
        return
      }

      switch (e.key) {
        case 'n':
        case 'N':
          e.preventDefault()
          setSelectedEvent(null)
          setQuickCreateStartTime(new Date())
          setEventDialogOpen(true)
          break
        case '/': {
          e.preventDefault()

          const searchInput = document.querySelector(
            'input[placeholder="' + t.searchEvents + '"]',
          ) as HTMLInputElement
          if (searchInput) {
            searchInput.focus()
          }
          break
        }
        case 't':
        case 'T':
          e.preventDefault()
          handleTodayClick()
          break
        case '1':
          e.preventDefault()
          setView('day')
          break
        case '2':
          e.preventDefault()
          setView('week')
          break
        case '3':
          e.preventDefault()
          setView('month')
          break
        case '4':
          e.preventDefault()
          setView('year')
          break
        case '5':
          e.preventDefault()
          setView('four-day')
          break
        case 'ArrowRight':
          e.preventDefault()
          handleNext()
          break
        case 'ArrowLeft':
          e.preventDefault()
          handlePrevious()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enableShortcuts, t.searchEvents, view])

  const toggleSidebar = () => {
    setIsSidebarTransitioning(true)
    setIsSidebarCollapsed((prev) => !prev)
  }

  const handleDateSelect = (date: Date) => {
    setDate(date)
    setSidebarDate(date)
  }

  const handleViewChange = (newView: ViewType) => {
    setView(newView)
  }

  const handleUserProfileSectionNavigate = (section: UserProfileSection) => {
    setView('settings')
    setFocusUserProfileSection(null)
    setTimeout(() => setFocusUserProfileSection(section), 0)
  }

  const handleTodayClick = () => {
    const today = new Date()
    setDate(today)
    setSidebarDate(today)
  }

  const handlePrevious = () => {
    setDate((prevDate) => {
      if (view === 'day') return subDays(prevDate, 1)
      if (view === 'week') return subDays(prevDate, 7)
      if (view === 'four-day') return subDays(prevDate, 4)
      if (view === 'year') return subYears(prevDate, 1)
      return subDays(prevDate, 30)
    })
  }

  const handleNext = () => {
    setDate((prevDate) => {
      if (view === 'day') return addDays(prevDate, 1)
      if (view === 'week') return addDays(prevDate, 7)
      if (view === 'four-day') return addDays(prevDate, 4)
      if (view === 'year') return addYears(prevDate, 1)
      return addDays(prevDate, 30)
    })
  }

  const formatDateDisplay = (date: Date) => {
    if (view === 'year') {
      return date.getFullYear().toString()
    }

    if (view === 'four-day') {
      const startDate = new Date(date)
      const endDate = addDays(startDate, 3)
      const options: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
      }
      return `${startDate.toLocaleDateString(language, options)} - ${endDate.toLocaleDateString(language, options)}`
    }

    if (language === 'en') {
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
      }
      return date.toLocaleDateString(language, options)
    } else {
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
      }
      return date.toLocaleDateString(language, options)
    }
  }

  const handleEventClick = (
    event: CalendarEvent,
    anchorEl?: HTMLElement | null,
    clientX?: number,
    clientY?: number,
  ) => {
    setShareOnlyMode(false)
    setPreviewEvent(event)
    if (clientX !== undefined && clientY !== undefined) {
      setPreviewAnchorRect(
        DOMRect.fromRect({
          x: clientX,
          y: clientY,
          width: 0,
          height: 0,
        }),
      )
    } else {
      setPreviewAnchorRect(anchorEl?.getBoundingClientRect() ?? null)
    }
    setPreviewOpen(true)
  }

  const handleNavigateAndPreview = (event: CalendarEvent) => {
    setDate(new Date(event.startDate))
    setView(defaultView as ViewType)
    setPreviewEvent(event)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-event-id="${event.id}"]`)
        if (el) {
          setPreviewAnchorRect(el.getBoundingClientRect())
        } else if (calendarRef.current) {
          setPreviewAnchorRect(
            DOMRect.fromRect({
              x: calendarRef.current.getBoundingClientRect().left + 16,
              y: calendarRef.current.getBoundingClientRect().top + 16,
              width: 0,
              height: 0,
            }),
          )
        } else {
          setPreviewAnchorRect(null)
        }
        setPreviewOpen(true)
      })
    })
  }

  const handleEventAdd = (event: CalendarEvent) => {
    const newEvent = {
      ...event,
      id:
        event.id ||
        Date.now().toString() + Math.random().toString(36).substring(2, 9),
    }

    setEvents((prevEvents) => [...prevEvents, newEvent])
    upsertEvent({
      id: newEvent.id,
      title: newEvent.title,
      startDate: newEvent.startDate.toISOString(),
      endDate: newEvent.endDate.toISOString(),
      isAllDay: newEvent.isAllDay,
      color: newEvent.color,
      location: newEvent.location,
      description: newEvent.description,
      notificationMinutes: newEvent.notification,
    })
    toast(t.eventCreated)
    setEventDialogOpen(false)
    setSelectedEvent(null)
    setQuickCreateStartTime(null)
  }

  const handleEventUpdate = (updatedEvent: CalendarEvent) => {
    setEvents((prevEvents) =>
      prevEvents.map((event) =>
        event.id === updatedEvent.id ? updatedEvent : event,
      ),
    )
    upsertEvent({
      id: updatedEvent.id,
      title: updatedEvent.title,
      startDate: updatedEvent.startDate.toISOString(),
      endDate: updatedEvent.endDate.toISOString(),
      isAllDay: updatedEvent.isAllDay,
      color: updatedEvent.color,
      location: updatedEvent.location,
      description: updatedEvent.description,
      notificationMinutes: updatedEvent.notification,
    })
    toast(t.eventUpdated)
    setEventDialogOpen(false)
    setSelectedEvent(null)
    setQuickCreateStartTime(null)
  }

  const handleEventDelete = (eventId: string) => {
    const targetEvent = events.find((event) => event.id === eventId)
    if (!targetEvent) return
    setPendingDeleteEvent(targetEvent)
    setDeleteConfirmOpen(true)
  }

  const confirmEventDelete = async () => {
    if (!pendingDeleteEvent) return

    const deletedEvent = pendingDeleteEvent
    let cancelled = false

    setEvents((prevEvents) =>
      prevEvents.filter((event) => event.id !== deletedEvent.id),
    )

    toast(t.eventDeleted, {
      description: deletedEvent.title,
      action: {
        label: t.undo,
        onClick: () => {
          cancelled = true
          setEvents((prevEvents) => {
            if (prevEvents.some((event) => event.id === deletedEvent.id))
              return prevEvents
            return [...prevEvents, deletedEvent].sort(
              (a, b) =>
                new Date(a.startDate).getTime() -
                new Date(b.startDate).getTime(),
            )
          })
          upsertEvent({
            id: deletedEvent.id,
            title: deletedEvent.title,
            startDate: deletedEvent.startDate.toISOString(),
            endDate: deletedEvent.endDate.toISOString(),
            isAllDay: deletedEvent.isAllDay,
            location: deletedEvent.location || null,
            participants: deletedEvent.participants?.length
              ? deletedEvent.participants.map((p: any) =>
                  typeof p === 'string' ? { name: p } : p,
                )
              : null,
            notificationMinutes: deletedEvent.notification || null,
            color: deletedEvent.color || null,
            categoryId: deletedEvent.calendarId || null,
          }).catch(() => {})
          toast(t.deletionUndone)
        },
      },
    })

    setEventDialogOpen(false)
    setSelectedEvent(null)
    setPreviewOpen(false)
    setDeleteConfirmOpen(false)
    setPendingDeleteEvent(null)

    try {
      await deleteBookmarkByEvent(deletedEvent.id)
    } catch {}
    if (cancelled) return
    try {
      await deleteEvent(deletedEvent.id)
    } catch {}
  }

  const handleImportEvents = (importedEvents: CalendarEvent[]) => {
    const newEvents = importedEvents.map((event) => ({
      ...event,
      id: event.id || Math.random().toString(36).substring(7),
    })) as CalendarEvent[]
    setEvents((prevEvents) => [...prevEvents, ...newEvents])
  }

  const handleEventEdit = (event?: CalendarEvent) => {
    const targetEvent = event ?? previewEvent
    if (targetEvent) {
      setSelectedEvent(targetEvent)
      setQuickCreateStartTime(null)
      setEventDialogOpen(true)
      setPreviewOpen(false)
      setPreviewAnchorRect(null)
    }
  }

  const handleEventDuplicate = (event: CalendarEvent) => {
    const duplicatedEvent = {
      ...event,
      id: Math.random().toString(36).substring(7),
    }
    setEvents((prevEvents) => [...prevEvents, duplicatedEvent])
    setPreviewOpen(false)
    setPreviewAnchorRect(null)
  }

  const handleTimeRangeSelect = (startTime: Date, endTime?: Date) => {
    setQuickCreateStartTime(startTime)
    setQuickCreateEndTime(endTime ?? null)

    setSelectedEvent(null)
    setEventDialogOpen(true)
  }

  const toggleBookmark = async (event: CalendarEvent) => {
    const { bookmarks } = await api.bookmarks.list()
    const isBookmarked = bookmarks.some((b) => b.eventId === event.id)
    if (isBookmarked) {
      const bm = bookmarks.find((b) => b.eventId === event.id)
      if (bm) await api.bookmarks.delete(bm.id)
    } else {
      await api.bookmarks.create({ eventId: event.id })
    }
  }

  const handleShare = (event: CalendarEvent, shareOnly = false) => {
    setShareOnlyMode(shareOnly)
    setPreviewEvent(event)
    setPreviewAnchorRect(null)
    setOpenShareImmediately(true)
    setPreviewOpen(true)
  }

  const eventsByCategory = useMemo(() => {
    if (selectedCategoryFilters.length === 0) return events

    return events.filter((event) => {
      if (!event.calendarId) {
        return selectedCategoryFilters.includes('__uncategorized__')
      }

      const hasCategory = calendars.some((cal) => cal.id === event.calendarId)
      if (!hasCategory)
        return selectedCategoryFilters.includes('__uncategorized__')
      return selectedCategoryFilters.includes(event.calendarId)
    })
  }, [events, selectedCategoryFilters, calendars])

  const filteredEvents = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    if (!keyword) return eventsByCategory

    return eventsByCategory
      .filter((event) => {
        const title = event.title?.toLowerCase() || ''
        const location = event.location?.toLowerCase() || ''
        const description = event.description?.toLowerCase() || ''
        return (
          title.includes(keyword) ||
          location.includes(keyword) ||
          description.includes(keyword)
        )
      })
      .sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      )
  }, [eventsByCategory, searchTerm])

  const searchResultEvents = useMemo(() => {
    if (!searchTerm.trim()) return []
    return filteredEvents.slice(0, 8)
  }, [filteredEvents, searchTerm])

  useNotifications(events, notificationSound)

  return (
    <div className={className}>
      <div className="relative flex h-dvh overflow-hidden bg-background">
        {}
        <Sidebar
          onCreateEvent={() => {
            setSelectedEvent(null)
            setQuickCreateStartTime(new Date())
            setEventDialogOpen(true)
          }}
          onDateSelect={handleDateSelect}
          onViewChange={handleViewChange}
          language={language}
          selectedDate={sidebarDate}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          selectedCategoryFilters={selectedCategoryFilters}
          onCategoryFilterChange={(categoryId, checked) => {
            setSelectedCategoryFilters((prev) => {
              if (checked) {
                return prev.includes(categoryId) ? prev : [...prev, categoryId]
              }
              return prev.filter((id) => id !== categoryId)
            })
          }}
          onCollapseTransitionEnd={() => setIsSidebarTransitioning(false)}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {' '}
          <header className="flex items-center px-4 h-16 border-b relative z-40 bg-background">
            <div className="pointer-events-none absolute right-0 bottom-0 h-px w-14 bg-background" />
            <div className="flex items-center space-x-4">
              <Button variant="outline" onClick={toggleSidebar} size="sm">
                <PanelLeft />
              </Button>
              <Button variant="outline" size="sm" onClick={handleTodayClick}>
                {t.today || '今天'}
              </Button>
              {view !== 'analytics' && view !== 'settings' && (
                <>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handlePrevious}
                    >
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

            <div className="ml-auto flex items-center space-x-2">
              <div className="relative z-50">
                <Select
                  value={
                    view === 'day' ||
                    view === 'week' ||
                    view === 'four-day' ||
                    view === 'month' ||
                    view === 'year'
                      ? view
                      : defaultView === 'day' ||
                          defaultView === 'week' ||
                          defaultView === 'four-day' ||
                          defaultView === 'month' ||
                          defaultView === 'year'
                        ? defaultView
                        : 'week'
                  }
                  onValueChange={(value) => {
                    if (isCalendarView(value)) {
                      setView(value)
                    }
                  }}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="day">{t.day}</SelectItem>
                      <SelectItem value="week">{t.week}</SelectItem>
                      <SelectItem value="month">{t.month}</SelectItem>
                      <SelectItem value="year">{t.year}</SelectItem>
                      <SelectItem value="four-day">{t.fourDay}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="relative z-50" ref={searchInputRef}>
                <InputGroup className="w-48">
                  <InputGroupAddon>
                    <Search className="h-5 w-5 text-gray-400" />
                  </InputGroupAddon>
                  <InputGroupInput
                    type="text"
                    placeholder={t.searchEvents}
                    value={searchTerm}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => {
                      window.setTimeout(() => setIsSearchFocused(false), 120)
                    }}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchResultEvents.length > 0) {
                        handleNavigateAndPreview(searchResultEvents[0])
                        setSearchTerm('')
                        setIsSearchFocused(false)
                      }
                    }}
                    className="pr-4"
                  />
                </InputGroup>
                {isSearchFocused &&
                  !!searchTerm &&
                  searchInputRef.current &&
                  typeof document !== 'undefined' &&
                  createPortal(
                    <div
                      className="fixed z-[100] w-80 rounded-md border bg-popover p-1 shadow-md"
                      style={{
                        left: searchInputRef.current.getBoundingClientRect()
                          .right,
                        top:
                          searchInputRef.current.getBoundingClientRect()
                            .bottom + 6,
                        transform: 'translateX(-100%)',
                      }}
                    >
                      {searchResultEvents.length > 0 ? (
                        <ScrollArea className="max-h-[320px]">
                          <div className="space-y-1">
                            {searchResultEvents.map((event) => (
                              <button
                                key={event.id}
                                type="button"
                                className="flex w-full cursor-pointer items-start gap-2 rounded-sm px-2 py-2 text-left hover:bg-accent"
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  handleNavigateAndPreview(event)
                                  setSearchTerm('')
                                  setIsSearchFocused(false)
                                }}
                              >
                                <div
                                  className="mt-0.5 h-4 w-1 shrink-0 rounded-full"
                                  style={{
                                    backgroundColor: getEventAccentColor(
                                      event.color,
                                    ),
                                  }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-medium leading-none">
                                    {event.title || t.unnamedEvent}
                                  </div>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {formatDateDisplay(
                                      new Date(event.startDate),
                                    )}
                                  </div>
                                  {event.location && (
                                    <div className="truncate text-xs text-muted-foreground">
                                      {event.location}
                                    </div>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                          {t.noMatchingEvents}
                        </div>
                      )}
                    </div>,
                    document.body,
                  )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full h-8 w-8"
                    aria-label="Help"
                  >
                    <CircleHelp className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isSignedIn ? (
                    <DropdownMenuItem onClick={() => router.push('/landing')}>
                      <House className="mr-2 h-4 w-4" />
                      {t.home || 'Home'}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    onClick={() =>
                      window.open(
                        APP_CONFIG.contact.statusPageUrl,
                        '_blank',
                        'noopener,noreferrer',
                      )
                    }
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    {t.status}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      window.location.href = `mailto:${APP_CONFIG.contact.feedbackEmail}`
                    }}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    {t.feedback}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/privacy')}>
                    <FileText className="mr-2 h-4 w-4" />
                    {t.privacy}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/terms')}>
                    <ScrollText className="mr-2 h-4 w-4" />
                    {t.tos}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <UserProfileButton
                variant="outline"
                className="rounded-full h-8 w-8"
                _onNavigateToSettings={handleUserProfileSectionNavigate}
                onNavigateToView={setView}
              />
            </div>
          </header>
          <div className="flex-1 overflow-auto pr-14" ref={calendarRef}>
            {view === 'day' && (
              <DayView
                date={date}
                events={filteredEvents}
                onEventClick={handleEventClick}
                onTimeSlotClick={handleTimeRangeSelect}
                config={viewConfig}
                onEditEvent={handleEventEdit}
                onDeleteEvent={(event) => handleEventDelete(event.id)}
                onShareEvent={(event) => {
                  handleShare(event, true)
                }}
                onBookmarkEvent={toggleBookmark}
                onEventDrop={handleEventDrop}
                onBackToCalendar={() => setView(defaultView)}
              />
            )}
            {view === 'week' && (
              <WeekView
                date={date}
                events={filteredEvents}
                onEventClick={handleEventClick}
                onTimeSlotClick={handleTimeRangeSelect}
                config={viewConfig}
                onEditEvent={handleEventEdit}
                onDeleteEvent={(event) => handleEventDelete(event.id)}
                onShareEvent={(event) => {
                  handleShare(event, true)
                }}
                onBookmarkEvent={toggleBookmark}
                onEventDrop={handleEventDrop}
              />
            )}
            {view === 'four-day' && (
              <WeekView
                date={date}
                events={filteredEvents}
                onEventClick={handleEventClick}
                onTimeSlotClick={handleTimeRangeSelect}
                config={viewConfig}
                daysToShow={4}
                fixedStartDate={date}
                onEditEvent={handleEventEdit}
                onDeleteEvent={(event) => handleEventDelete(event.id)}
                onShareEvent={(event) => {
                  handleShare(event, true)
                }}
                onBookmarkEvent={toggleBookmark}
                onEventDrop={handleEventDrop}
              />
            )}
            {view === 'month' && (
              <MonthView
                date={date}
                events={filteredEvents}
                onEventClick={handleEventClick}
                config={viewConfig}
              />
            )}
            {view === 'year' && (
              <YearView
                date={date}
                events={filteredEvents}
                onEventClick={handleEventClick}
                config={viewConfig}
              />
            )}
            {view === 'analytics' && (
              <AnalyticsView
                events={events}
                onCreateEvent={(_startDate, _endDate) => {
                  setSelectedEvent(null)
                  setQuickCreateStartTime(_startDate)
                  setEventDialogOpen(true)
                }}
                onBackToCalendar={() => setView(defaultView)}
                isSidebarTransitioning={isSidebarTransitioning}
              />
            )}
            {view === 'settings' && (
              <Settings
                language={languageObj.code}
                setLanguage={(lang: string) =>
                  setLanguage(lang as Parameters<typeof setLanguage>[0])
                }
                firstDayOfWeek={firstDayOfWeekObj}
                setFirstDayOfWeek={handleFirstDayOfWeekChange}
                timezone={timezone}
                setTimezone={handleTimezoneChange}
                _notificationSound={notificationSound}
                _setNotificationSound={setNotificationSound}
                defaultView={CalendarViewType.create(
                  defaultView as CalendarViewTypeValue,
                )}
                setDefaultView={(view: CalendarViewType) =>
                  handleDefaultViewChange(view.value as CalendarViewTypeValue)
                }
                enableShortcuts={enableShortcuts}
                setEnableShortcuts={handleEnableShortcutsChange}
                timeFormat={timeFormatObj}
                setTimeFormat={(format: TimeFormat) =>
                  handleTimeFormatChange(format.value as TimeFormatValue)
                }
                events={events}
                onImportEvents={handleImportEvents}
                focusUserProfileSection={focusUserProfileSection}
                _toastPosition={toastPosition}
                _setToastPosition={handleToastPositionChange}
                onBackToCalendar={() => setView(defaultView)}
              />
            )}
          </div>
        </div>

        {}
        <RightSidebar
          onViewChange={handleViewChange}
          onEventClick={(event) => {
            handleNavigateAndPreview(event)
          }}
        />

        {}
        <EventPreview
          event={previewEvent}
          open={previewOpen}
          onOpenChange={(open) => {
            setPreviewOpen(open)
            if (!open) {
              setOpenShareImmediately(false)
              setPreviewAnchorRect(null)
            }
          }}
          onEdit={handleEventEdit}
          onDelete={() => {
            if (previewEvent) {
              handleEventDelete(previewEvent.id)
              setPreviewOpen(false)
              setPreviewAnchorRect(null)
            }
          }}
          _onDuplicate={() => {
            if (previewEvent) {
              handleEventDuplicate(previewEvent)
            }
          }}
          language={language}
          _timezone={timezone}
          openShareImmediately={openShareImmediately}
          shareOnlyMode={shareOnlyMode}
          anchorRect={previewAnchorRect}
          modal={view !== 'year'}
        />

        <EventDialog
          open={eventDialogOpen}
          onOpenChange={setEventDialogOpen}
          onEventAdd={handleEventAdd}
          onEventUpdate={handleEventUpdate}
          onEventDelete={handleEventDelete}
          initialDate={quickCreateStartTime || date}
          initialEndDate={quickCreateEndTime}
          event={selectedEvent}
          config={viewConfig}
        />

        <AlertDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.deleteEventConfirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {t.deleteEventConfirmDescription}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingDeleteEvent(null)}>
                {t.cancel}
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground"
                onClick={confirmEventDelete}
              >
                {t.delete}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
