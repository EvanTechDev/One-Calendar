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
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useCalendar } from '@/components/providers/calendar-context'
import {
  useSettings,
  useEvents,
  useBookmarks,
} from '@/components/providers/data-provider'
import { getValidTimezone } from '@/lib/timezone'
import { uuid } from '@/lib/uuid'
import RightSidebar from '@/components/app/sidebar/right-sidebar'
import { addDays, addYears, subDays, subYears } from 'date-fns'
import EventPreview, {
  type EventInvite,
} from '@/components/app/event/event-preview'
import EventDialog from '@/components/app/event/event-dialog'
import Sidebar from '@/components/app/sidebar/sidebar'
import { translations, useLanguage } from '@zntr/i18n/calendar'
import { THEME_OPTIONS, type ThemeOption } from '@/lib/theme'
import { useTheme } from 'next-themes'
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
} from '@/lib/calendar-types'
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
import { RadioGroup, RadioGroupItem } from '@zntr/ui/radio-group'
import { Label } from '@zntr/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@zntr/ui/dialog'

import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth/client'

const loadDayView = () => import('@/components/app/views/day-view')
const loadWeekView = () => import('@/components/app/views/week-view')
const loadMonthView = () => import('@/components/app/views/month-view')
const loadYearView = () => import('@/components/app/views/year-view')
const loadAnalyticsView = () =>
  import('@/components/app/analytics/analytics-view')
const loadSettingsDialog = () =>
  import('@/components/app/settings/settings-dialog')
import {
  defaultExpansionWindow,
  optimisticFollowingSplit,
} from '@/lib/recurrence/engine'

const DayView = dynamic(loadDayView)
const WeekView = dynamic(loadWeekView)
const MonthView = dynamic(loadMonthView)
const YearView = dynamic(loadYearView)
const AnalyticsView = dynamic(loadAnalyticsView)
const SettingsDialog = dynamic(loadSettingsDialog)

export interface CalendarEvent {
  id: string
  title: string
  startDate: Date
  endDate: Date
  isAllDay: boolean
  rrule?: string | null
  exdate?: string[] | null
  seriesId?: string | null
  recurrenceId?: string | null
  location?: string
  participants: string[]
  notification: number
  description?: string
  color: string
  calendarId: string
  viewOnly?: boolean
  organizer?: {
    name: string
    email: string
    image: string | null
  } | null
  invites?: Array<{
    id: string
    email: string
    status: 'pending' | 'accepted' | 'maybe' | 'declined'
    inviteToken: string
    emailSent: boolean
    addedToCalendar: boolean
    userName: string | null
    userImage: string | null
  }>
}

interface CalendarProps {
  className?: string
}

export default function Calendar({ className, ..._props }: CalendarProps) {
  const router = useRouter()
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
  const { setTheme } = useTheme()
  const { upsertEvent, deleteEvent, refreshEvents } = useEvents()
  const { bookmarks, createBookmark, deleteBookmarkByEvent } = useBookmarks()
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
  const [notificationSound] = useState<NOTIFICATION_SOUNDS>('telegram')
  const [previewEvent, setPreviewEvent] = useState<CalendarEvent | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewAnchorRect, setPreviewAnchorRect] = useState<DOMRect | null>(
    null,
  )
  const [previewAnchorEl, setPreviewAnchorEl] = useState<HTMLElement | null>(
    null,
  )
  const [focusUserProfileSection, setFocusUserProfileSection] =
    useState<UserProfileSection | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarDate, setSidebarDate] = useState<Date>(new Date())
  const [pendingDeleteEvent, setPendingDeleteEvent] =
    useState<CalendarEvent | null>(null)
  const [pendingDeleteApplyTo, setPendingDeleteApplyTo] = useState<
    'single' | 'following' | 'all' | undefined
  >(undefined)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [pendingRangeMove, setPendingRangeMove] = useState<{
    event: CalendarEvent
    startDate: Date
    endDate: Date
  } | null>(null)
  const [rangeMoveOpen, setRangeMoveOpen] = useState(false)
  const [rangeMoveScope, setRangeMoveScope] = useState<
    'single' | 'following' | 'all'
  >('single')
  const [deleteScope, setDeleteScope] = useState<'single' | 'all'>('single')
  const [pendingRemoveInvite, setPendingRemoveInvite] =
    useState<CalendarEvent | null>(null)
  const [removeInviteConfirmOpen, setRemoveInviteConfirmOpen] = useState(false)
  const [pendingInvites, setPendingInvites] = useState<{
    eventId: string
    emails: string[]
  } | null>(null)
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
    if (event.viewOnly) return
    setPreviewOpen(false)
    setPreviewAnchorRect(null)
    setPreviewAnchorEl(null)
    if (event.rrule || event.seriesId || event.recurrenceId) {
      setPendingRangeMove({
        event,
        startDate: newStartDate,
        endDate: newEndDate,
      })
      setRangeMoveScope('single')
      setRangeMoveOpen(true)
      return
    }
    commitRangeMove(event, newStartDate, newEndDate)
  }

  const commitRangeMove = (
    event: CalendarEvent,
    newStartDate: Date,
    newEndDate: Date,
    scope?: 'single' | 'following' | 'all',
  ) => {
    const updatedEvent = {
      ...event,
      startDate: newStartDate,
      endDate: newEndDate,
    }
    // Same discipline as handleEventUpdate: decide the split ids before
    // touching the store, keep the zustand updater pure, and never let a
    // synchronous planning failure kill the save.
    let splitId: string | null = null
    let oldSeriesId: string | null = null
    let optimisticEvents: CalendarEvent[] | null = null
    if (scope === 'following') {
      try {
        splitId = uuid()
        oldSeriesId =
          updatedEvent.seriesId ?? (updatedEvent.rrule ? updatedEvent.id : null)
        if (updatedEvent.seriesId && updatedEvent.recurrenceId) {
          const window = defaultExpansionWindow()
          const nextMaster = {
            ...updatedEvent,
            id: splitId,
            seriesId: null,
            recurrenceId: null,
            rrule: updatedEvent.rrule ?? null,
          }
          const target = events.find((item) => item.id === updatedEvent.id)
          if (target) {
            optimisticEvents = optimisticFollowingSplit(
              events,
              target,
              nextMaster,
              window.windowStart,
              window.windowEnd,
              undefined,
              timezone,
            )
          }
        }
      } catch {
        splitId = null
        optimisticEvents = null
      }
    }
    if (optimisticEvents) {
      setEvents(optimisticEvents)
    } else {
      updateEvent(updatedEvent)
    }
    upsertEvent(
      {
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
        apply_to: scope,
        split_id: splitId ?? undefined,
        timezone,
      },
      oldSeriesId ? new Set([oldSeriesId]) : undefined,
    ).catch(() => {})
  }

  const confirmRangeMove = (scope: 'single' | 'following' | 'all') => {
    if (!pendingRangeMove) return
    commitRangeMove(
      pendingRangeMove.event,
      pendingRangeMove.startDate,
      pendingRangeMove.endDate,
      scope,
    )
    setRangeMoveOpen(false)
    setPendingRangeMove(null)
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
        if (settings.language)
          setLanguage(settings.language as Parameters<typeof setLanguage>[0])
      },
      () => {
        if (
          settings.theme &&
          THEME_OPTIONS.includes(settings.theme as ThemeOption)
        ) {
          setTheme(settings.theme as ThemeOption)
        }
      },
    ]
    settingsSync.forEach((fn) => fn())
  }, [settings])

  useEffect(() => {
    const handleTimezoneEvent = (event: Event) => {
      const { timezone } = (event as CustomEvent<{ timezone?: string }>).detail
      if (timezone) handleTimezoneChange(timezone)
    }
    const handleFirstDayEvent = (event: Event) => {
      const { firstDay } = (event as CustomEvent<{ firstDay?: number }>).detail
      if (firstDay !== undefined) {
        setFirstDayOfWeek(firstDay as FirstDayOfWeekValue)
        updateSettings({ firstDayOfWeek: firstDay }).catch(() => {})
      }
    }
    const handleViewEvent = (event: Event) => {
      const { view } = (event as CustomEvent<{ view?: string }>).detail
      if (view && isCalendarView(view)) {
        setDefaultView(view as CalendarViewTypeValue)
        setView(view as ViewType)
        updateSettings({ defaultView: view }).catch(() => {})
      }
    }
    const handleTimeFormatEvent = (event: Event) => {
      const { format } = (event as CustomEvent<{ format?: string }>).detail
      if (format === '24h' || format === '12h') {
        setTimeFormat(format)
        updateSettings({ timeFormat: format }).catch(() => {})
      }
    }
    window.addEventListener('timezonechange', handleTimezoneEvent)
    window.addEventListener('firstdaychange', handleFirstDayEvent)
    window.addEventListener('viewchange', handleViewEvent)
    window.addEventListener('timeformatchange', handleTimeFormatEvent)
    return () => {
      window.removeEventListener('timezonechange', handleTimezoneEvent)
      window.removeEventListener('firstdaychange', handleFirstDayEvent)
      window.removeEventListener('viewchange', handleViewEvent)
      window.removeEventListener('timeformatchange', handleTimeFormatEvent)
    }
  }, [])

  useEffect(() => {
    const prefetch = () => {
      void loadDayView()
      void loadWeekView()
      void loadMonthView()
      void loadYearView()
      void loadAnalyticsView()
      void loadSettingsDialog()
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
    setSettingsOpen(true)
    setFocusUserProfileSection(null)
    setTimeout(() => setFocusUserProfileSection(section), 0)
  }

  const handleNavigateToView = (target: 'analytics' | 'settings') => {
    if (target === 'settings') {
      setSettingsOpen(true)
      return
    }
    setView(target)
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
    if (previewOpen && previewEvent?.id === event.id) {
      setPreviewOpen(false)
      setPreviewAnchorRect(null)
      setPreviewAnchorEl(null)
      return
    }
    setPreviewEvent(event)
    setPreviewAnchorEl(anchorEl ?? null)
    if (view === 'day' && clientX !== undefined && clientY !== undefined) {
      setPreviewAnchorRect(
        DOMRect.fromRect({ x: clientX, y: clientY, width: 0, height: 0 }),
      )
    } else if (clientY !== undefined && anchorEl) {
      const rect = anchorEl.getBoundingClientRect()
      setPreviewAnchorRect(
        DOMRect.fromRect({
          x: rect.left,
          y: clientY,
          width: rect.width,
          height: 0,
        }),
      )
    } else {
      setPreviewAnchorRect(anchorEl?.getBoundingClientRect() ?? null)
    }
    setPreviewOpen(true)
  }

  const handleNavigateAndPreview = (event: CalendarEvent) => {
    const eventId = (event as any).eventId ?? event.id
    const realEvent = events.find((e) => e.id === eventId) ?? event
    setDate(new Date(realEvent.startDate))
    setView(defaultView as ViewType)
    setPreviewEvent(realEvent)
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-event-id="${eventId}"]`)
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'instant' })
        requestAnimationFrame(() => {
          setPreviewAnchorRect(el.getBoundingClientRect())
          setPreviewAnchorEl(el as HTMLElement)
          setPreviewOpen(true)
        })
      } else if (calendarRef.current) {
        setPreviewAnchorRect(
          DOMRect.fromRect({
            x: calendarRef.current.getBoundingClientRect().left + 16,
            y: calendarRef.current.getBoundingClientRect().top + 16,
            width: 0,
            height: 0,
          }),
        )
        setPreviewOpen(true)
      } else {
        setPreviewAnchorRect(null)
        setPreviewOpen(true)
      }
    })
  }

  const handleEventAdd = (event: CalendarEvent) => {
    const newEvent = {
      ...event,
      id: event.id || uuid(),
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
      participants: newEvent.participants?.length
        ? newEvent.participants.map((p: any) =>
            typeof p === 'string' ? { name: p } : p,
          )
        : null,
      notificationMinutes: newEvent.notification,
      categoryId: newEvent.calendarId || null,
      rrule: newEvent.rrule ?? null,
      timezone,
    })
    toast(t.eventCreated)
    setEventDialogOpen(false)
    setSelectedEvent(null)
    setQuickCreateStartTime(null)
  }

  const handleEventUpdate = (
    updatedEvent: CalendarEvent,
    applyTo?: 'single' | 'following' | 'all',
  ) => {
    // Plan a "this and following" split OUTSIDE the zustand updater: the
    // updater must stay pure, and splitId/oldSeriesId have to be decided
    // exactly once up front — when the event is a raw series master (no
    // seriesId/recurrenceId) the server still splits at the series root,
    // so those ids must be sent or the old series would linger as ghosts.
    // The whole plan is wrapped so a synchronous failure can never kill
    // the save — without splitId the server assigns the new series id and
    // its response reconciles the view.
    let splitId: string | null = null
    let oldSeriesId: string | null = null
    let optimisticEvents: CalendarEvent[] | null = null
    if (applyTo === 'following') {
      try {
        splitId = uuid()
        oldSeriesId =
          updatedEvent.seriesId ?? (updatedEvent.rrule ? updatedEvent.id : null)
        if (updatedEvent.seriesId && updatedEvent.recurrenceId) {
          const window = defaultExpansionWindow()
          const nextMaster = {
            ...updatedEvent,
            id: splitId,
            seriesId: null,
            recurrenceId: null,
            rrule: updatedEvent.rrule ?? null,
          }
          const target = events.find((event) => event.id === updatedEvent.id)
          if (target) {
            optimisticEvents = optimisticFollowingSplit(
              events,
              target,
              nextMaster,
              window.windowStart,
              window.windowEnd,
              undefined,
              timezone,
            )
          }
        }
      } catch {
        splitId = null
        optimisticEvents = null
      }
    }
    if (optimisticEvents) {
      setEvents(optimisticEvents)
    } else {
      setEvents((prevEvents) =>
        prevEvents.map((event) =>
          event.id === updatedEvent.id ? updatedEvent : event,
        ),
      )
    }
    upsertEvent(
      {
        id: updatedEvent.id,
        title: updatedEvent.title,
        startDate: updatedEvent.startDate.toISOString(),
        endDate: updatedEvent.endDate.toISOString(),
        isAllDay: updatedEvent.isAllDay,
        color: updatedEvent.color,
        location: updatedEvent.location,
        description: updatedEvent.description,
        participants: updatedEvent.participants?.length
          ? updatedEvent.participants.map((p: any) =>
              typeof p === 'string' ? { name: p } : p,
            )
          : null,
        notificationMinutes: updatedEvent.notification,
        categoryId: updatedEvent.calendarId || null,
        rrule: updatedEvent.rrule ? updatedEvent.rrule : undefined,
        apply_to: applyTo,
        split_id: splitId ?? undefined,
        timezone,
      },
      oldSeriesId ? new Set([oldSeriesId]) : undefined,
    )
    toast(t.eventUpdated)
    setEventDialogOpen(false)
    setSelectedEvent(null)
    setQuickCreateStartTime(null)
  }

  const handleEventDelete = (
    eventId: string,
    applyTo?: 'single' | 'following' | 'all',
  ) => {
    const targetEvent = events.find((event) => event.id === eventId)
    if (!targetEvent) return
    setPendingDeleteEvent(targetEvent)
    setPendingDeleteApplyTo(applyTo)
    setDeleteScope(applyTo === 'all' ? 'all' : 'single')
    setDeleteConfirmOpen(true)
  }

  const confirmEventDelete = async (
    applyToOverride?: 'single' | 'following' | 'all',
  ) => {
    if (!pendingDeleteEvent) return

    const deletedEvent = pendingDeleteEvent
    const applyTo = applyToOverride ?? pendingDeleteApplyTo
    let cancelled = false

    setEvents((prevEvents) => {
      if (applyTo === 'all' && deletedEvent.seriesId) {
        return prevEvents.filter(
          (event) => event.seriesId !== deletedEvent.seriesId,
        )
      }
      if (
        applyTo === 'following' &&
        deletedEvent.seriesId &&
        deletedEvent.recurrenceId
      ) {
        return prevEvents.filter(
          (event) =>
            event.seriesId !== deletedEvent.seriesId ||
            (event.recurrenceId ?? '') < deletedEvent.recurrenceId!,
        )
      }
      return prevEvents.filter((event) => event.id !== deletedEvent.id)
    })

    void deleteEvent(deletedEvent.id, applyTo, timezone, {
      deferNetwork: true,
    }).catch(() => {})

    const deleteTimer = window.setTimeout(() => {
      if (cancelled) return
      void (async () => {
        try {
          await deleteBookmarkByEvent(deletedEvent.id)
        } catch {}
        try {
          await deleteEvent(deletedEvent.id, applyTo, timezone)
        } catch {}
      })()
    }, 6000)

    toast.success(t.eventDeleted, {
      description: deletedEvent.title,
      duration: 6000,
      action: {
        label: t.undo,
        onClick: () => {
          cancelled = true
          window.clearTimeout(deleteTimer)
          if (
            deletedEvent.rrule ||
            deletedEvent.seriesId ||
            deletedEvent.recurrenceId
          ) {
            void refreshEvents()
            toast(t.deletionUndone)
            return
          }
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
            timezone,
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
  }

  const reAddInviteToCalendar = async (
    targetEvent: CalendarEvent,
    inviteToken?: string,
  ) => {
    if (inviteToken) {
      await fetch(`/api/invite/${inviteToken}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: targetEvent.calendarId ?? '__uncategorized__',
        }),
      }).catch(() => {})
    }
    setEvents((prevEvents) => {
      if (prevEvents.some((event) => event.id === targetEvent.id))
        return prevEvents
      return [...prevEvents, targetEvent].sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      )
    })
  }

  const confirmRemoveInvite = async () => {
    if (!pendingRemoveInvite) return

    const targetEvent = pendingRemoveInvite
    const ownInvite = targetEvent.invites?.find(
      (i) => i.email === session?.user?.email?.toLowerCase(),
    )
    const inviteToken = ownInvite?.inviteToken

    setEvents((prevEvents) =>
      prevEvents.filter((event) => event.id !== targetEvent.id),
    )
    setRemoveInviteConfirmOpen(false)
    setPendingRemoveInvite(null)

    let undone = false
    toast(t.eventDeleted, {
      description: targetEvent.title,
      action: {
        label: t.undo,
        onClick: () => {
          undone = true
          void reAddInviteToCalendar(targetEvent, inviteToken)
          toast(t.deletionUndone)
        },
      },
    })

    try {
      await fetch(
        `/api/invites?eventId=${encodeURIComponent(targetEvent.id)}`,
        { method: 'DELETE' },
      )
    } catch {}

    if (undone && inviteToken) {
      await reAddInviteToCalendar(targetEvent, inviteToken)
    }
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
      setPreviewAnchorEl(null)
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
    setPreviewAnchorEl(null)
  }

  const handleTimeRangeSelect = (startTime: Date, endTime?: Date) => {
    setQuickCreateStartTime(startTime)
    setQuickCreateEndTime(endTime ?? null)

    setSelectedEvent(null)
    setPreviewOpen(false)
    setPreviewAnchorRect(null)
    setPreviewAnchorEl(null)
    setEventDialogOpen(true)
  }

  const handleInvitesAdded = (eventId: string, emails: string[]) => {
    if (emails.length === 0) return
    setPendingInvites({ eventId, emails })
  }

  const handleSendInvites = async () => {
    if (!pendingInvites) return
    const { eventId, emails } = pendingInvites
    setPendingInvites(null)
    try {
      const response = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, emails }),
      })
      if (!response.ok) throw new Error('failed')
      await refreshEventInvites(eventId)
      toast.success('Invitations sent')
    } catch {
      toast.error('Failed to send invitations')
    }
  }

  const handleSkipInvites = async () => {
    if (!pendingInvites) return
    const { eventId, emails } = pendingInvites
    setPendingInvites(null)
    try {
      const response = await fetch('/api/invites/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, emails }),
      })
      if (!response.ok) throw new Error('failed')
      await refreshEventInvites(eventId)
    } catch {
      toast.error('Failed to add participants')
    }
  }

  const refreshEventInvites = async (eventId: string) => {
    try {
      const response = await fetch(
        `/api/invites?eventId=${encodeURIComponent(eventId)}`,
      )
      if (!response.ok) return
      const data = await response.json()
      const invites = data?.invites
      if (!Array.isArray(invites)) return
      setEvents((prevEvents) =>
        prevEvents.map((event) =>
          event.id === eventId ? { ...event, invites } : event,
        ),
      )
      setPreviewEvent((prev) =>
        prev?.id === eventId ? { ...prev, invites } : prev,
      )
      setSelectedEvent((prev) =>
        prev?.id === eventId ? { ...prev, invites } : prev,
      )
    } catch {}
  }

  const handlePreviewInvitesChange = useCallback(
    (eventId: string, invites: EventInvite[]) => {
      setEvents((prevEvents) =>
        prevEvents.map((event) =>
          event.id === eventId ? { ...event, invites } : event,
        ),
      )
      setPreviewEvent((prev) =>
        prev?.id === eventId ? { ...prev, invites } : prev,
      )
      setSelectedEvent((prev) =>
        prev?.id === eventId ? { ...prev, invites } : prev,
      )
    },
    [],
  )

  const handlePreviewCategoryChange = useCallback(
    (eventId: string, calendarId: string | null) => {
      setEvents((prevEvents) =>
        prevEvents.map((event) =>
          event.id === eventId
            ? { ...event, calendarId: calendarId ?? '' }
            : event,
        ),
      )
      setPreviewEvent((prev) =>
        prev?.id === eventId ? { ...prev, calendarId: calendarId ?? '' } : prev,
      )
      setSelectedEvent((prev) =>
        prev?.id === eventId ? { ...prev, calendarId: calendarId ?? '' } : prev,
      )
    },
    [],
  )

  const toggleBookmark = async (event: CalendarEvent) => {
    const isBookmarked = bookmarks.some((b) => b.eventId === event.id)
    if (isBookmarked) {
      await deleteBookmarkByEvent(event.id)
    } else {
      await createBookmark({ eventId: event.id })
    }
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
              {view !== 'analytics' && (
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
                        <div className="min-h-0 max-h-[320px] overflow-y-auto">
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
                        </div>
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
                onNavigateToView={handleNavigateToView}
              />
            </div>
          </header>
          <div
            className="relative flex-1 overflow-auto pr-14"
            ref={calendarRef}
          >
            {view === 'day' && (
              <DayView
                date={date}
                events={filteredEvents}
                onEventClick={handleEventClick}
                onTimeSlotClick={handleTimeRangeSelect}
                config={viewConfig}
                onEditEvent={handleEventEdit}
                onDeleteEvent={(event) => handleEventDelete(event.id)}
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
              setPreviewAnchorRect(null)
              setPreviewAnchorEl(null)
            }
          }}
          onEdit={handleEventEdit}
          onDelete={() => {
            if (previewEvent) {
              if (previewEvent.viewOnly) {
                setPendingRemoveInvite(previewEvent)
                setRemoveInviteConfirmOpen(true)
              } else {
                handleEventDelete(previewEvent.id)
              }
              setPreviewOpen(false)
              setPreviewAnchorRect(null)
              setPreviewAnchorEl(null)
            }
          }}
          _onDuplicate={() => {
            if (previewEvent) {
              handleEventDuplicate(previewEvent)
            }
          }}
          language={language}
          _timezone={timezone}
          anchorRect={previewAnchorRect}
          anchorElement={previewAnchorEl}
          scrollContainerRef={calendarRef}
          onInvitesChange={handlePreviewInvitesChange}
          onCategoryChange={handlePreviewCategoryChange}
        />

        <EventDialog
          open={eventDialogOpen}
          onOpenChange={setEventDialogOpen}
          onEventAdd={handleEventAdd}
          onEventUpdate={(event, applyTo) => handleEventUpdate(event, applyTo)}
          onEventDelete={(eventId, applyTo) =>
            handleEventDelete(eventId, applyTo)
          }
          onInvitesAdded={handleInvitesAdded}
          initialDate={quickCreateStartTime || date}
          initialEndDate={quickCreateEndTime}
          event={selectedEvent}
          config={viewConfig}
        />

        <Dialog
          open={!!pendingInvites}
          onOpenChange={(open) => {
            if (!open) setPendingInvites(null)
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Send Invitations?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {pendingInvites?.emails.length} participant
              {pendingInvites && pendingInvites.emails.length !== 1
                ? 's'
                : ''}{' '}
              added. Send invitation emails now?
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={handleSkipInvites}>
                Not now
              </Button>
              <Button onClick={handleSendInvites}>Send</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          language={languageObj.code}
          setLanguage={(lang: string) => {
            setLanguage(lang as Parameters<typeof setLanguage>[0])
            updateSettings({ language: lang }).catch(() => {})
          }}
          firstDayOfWeek={firstDayOfWeekObj}
          setFirstDayOfWeek={handleFirstDayOfWeekChange}
          timezone={timezone}
          setTimezone={handleTimezoneChange}
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
          focusSection={focusUserProfileSection}
          onFocusSectionHandled={() => setFocusUserProfileSection(null)}
        />

        <AlertDialog open={rangeMoveOpen} onOpenChange={setRangeMoveOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.repeatScope}</AlertDialogTitle>
              <AlertDialogDescription>
                {t.moveEventScopeDescription}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <RadioGroup
              value={rangeMoveScope}
              onValueChange={(value) =>
                setRangeMoveScope(value as 'single' | 'following' | 'all')
              }
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="single" id="range-move-scope-single" />
                <Label htmlFor="range-move-scope-single">
                  {t.repeatScopeSingle}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem
                  value="following"
                  id="range-move-scope-following"
                />
                <Label htmlFor="range-move-scope-following">
                  {t.repeatScopeFollowing}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="all" id="range-move-scope-all" />
                <Label htmlFor="range-move-scope-all">{t.repeatScopeAll}</Label>
              </div>
            </RadioGroup>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingRangeMove(null)}>
                {t.cancel}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => confirmRangeMove(rangeMoveScope)}
              >
                {t.confirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.deleteEventConfirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {t.deleteEventConfirmDescription}
                {pendingDeleteEvent &&
                  (pendingDeleteEvent.rrule ||
                    pendingDeleteEvent.seriesId ||
                    pendingDeleteEvent.recurrenceId) &&
                  ` ${t.deleteEventConfirmRecurring}`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {pendingDeleteEvent &&
            (pendingDeleteEvent.rrule ||
              pendingDeleteEvent.seriesId ||
              pendingDeleteEvent.recurrenceId) ? (
              <RadioGroup
                value={deleteScope}
                onValueChange={(value) =>
                  setDeleteScope(value as 'single' | 'all')
                }
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="single" id="delete-scope-single" />
                  <Label htmlFor="delete-scope-single">
                    {t.repeatDeleteThisOccurrence}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="all" id="delete-scope-all" />
                  <Label htmlFor="delete-scope-all">
                    {t.repeatDeleteAllOccurrences}
                  </Label>
                </div>
              </RadioGroup>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingDeleteEvent(null)}>
                {t.cancel}
              </AlertDialogCancel>
              {pendingDeleteEvent &&
              (pendingDeleteEvent.rrule ||
                pendingDeleteEvent.seriesId ||
                pendingDeleteEvent.recurrenceId) ? (
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground"
                  onClick={() => confirmEventDelete(deleteScope)}
                >
                  {t.delete}
                </AlertDialogAction>
              ) : (
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground"
                  onClick={() => confirmEventDelete()}
                >
                  {t.delete}
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={removeInviteConfirmOpen}
          onOpenChange={setRemoveInviteConfirmOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.deleteEventConfirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {t.deleteEventConfirmDescription}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingRemoveInvite(null)}>
                {t.cancel}
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground"
                onClick={confirmRemoveInvite}
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
