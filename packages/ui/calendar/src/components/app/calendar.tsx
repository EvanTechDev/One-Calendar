'use client'

import { useNotifications } from '#calendar/hooks/use-notifications'
import { anchorRectForClick } from '#calendar/hooks/use-anchored-popover'
import { defaultCreateRange } from '#calendar/components/app/views/selection-range'
import { useEventPreviewNavigation } from '#calendar/hooks/use-event-preview-navigation'
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
  Menu,
  CalendarCheck,
  Plus,
} from 'lucide-react'
import dynamic from '#calendar/lib/lazy-view'
import UserProfileButton from '#calendar/components/app/profile/user-profile-button'
import type { AccountSection } from '@zntr/auth/account'
import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react'
import {
  useCalendar,
  eventDataToCalendarEvent,
} from '#calendar/components/providers/calendar-context'
import { calendarLoadRange } from '#calendar/lib/calendar-range'

// Re-exported for the ~35 modules that already import it from here. The
// declaration has one home now (lib/calendar-types.ts); this used to be a
// second copy, kept in sync by hand, with a knip suppression hiding it.
// Imported as well as re-exported: `export … from` does not bind the name
// locally, and this file uses `CalendarEvent` in ~28 signatures.
import type { CalendarEvent } from '#calendar/lib/calendar-types'
export type { CalendarEvent }
import {
  useSettings,
  useEvents,
  useBookmarks,
} from '#calendar/components/providers/data-provider'
import { getValidTimezone } from '#calendar/lib/timezone'
import { toCalendarDate } from '#calendar/lib/zoned-date'
import { uuid } from '#calendar/lib/uuid'
import RightSidebar from '#calendar/components/app/sidebar/right-sidebar'
import { addDays, addYears, subDays, subYears } from 'date-fns'
import type { EventInvite } from '#calendar/components/app/event/event-preview'
import AuthWaitingLoading from '#calendar/components/app/auth-waiting-loading'
import Sidebar from '#calendar/components/app/sidebar/sidebar'
import MobileSidebarDrawer from '#calendar/components/app/sidebar/mobile-sidebar-drawer'
import { translations, useLanguage } from '@zntr/i18n/calendar'
import { THEME_OPTIONS, type ThemeOption } from '#calendar/lib/theme'
import { applyCalendarColor } from '#calendar/lib/calendar-colors'
import { useTheme } from 'next-themes'
import { Button } from '@zntr/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@zntr/ui/tooltip'
import { APP_CONFIG } from '#calendar/lib/config'
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
} from '#calendar/lib/calendar-types'
import { toast } from 'sonner'
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

import { useCalendarHost } from '@zntr/calendar-host'

const loadDayView = () => import('#calendar/components/app/views/day-view')
const loadWeekView = () => import('#calendar/components/app/views/week-view')
const loadMonthView = () => import('#calendar/components/app/views/month-view')
const loadYearView = () => import('#calendar/components/app/views/year-view')
const loadAnalyticsView = () =>
  import('#calendar/components/app/analytics/analytics-view')
const loadSettingsDialog = () =>
  import('#calendar/components/app/settings/settings-dialog')
const loadAiCommandPalette = () =>
  import('#calendar/components/app/ai/ai-command-palette').then(
    (m) => m.AiCommandPalette,
  )
const loadEventPreview = () =>
  import('#calendar/components/app/event/event-preview')
const loadEventEditor = () =>
  import('#calendar/components/app/event/event-editor')
import {
  defaultExpansionWindow,
  optimisticFollowingSplit,
} from '#calendar/lib/recurrence/engine'

const DayView = dynamic(loadDayView)
const WeekView = dynamic(loadWeekView)
const MonthView = dynamic(loadMonthView)
const YearView = dynamic(loadYearView)
const AnalyticsView = dynamic(loadAnalyticsView)
const SettingsDialog = dynamic(loadSettingsDialog)
// ssr: false — the palette carries the chat transport and is pure client
// interaction; there is nothing meaningful to render on the server.
const AiCommandPalette = dynamic(loadAiCommandPalette)
/**
 * The event preview and editor are ~3,200 lines between them, and drag
 * react-day-picker and react-remove-scroll along with them. Both render nothing
 * until they are opened, so none of that belongs in the chunk that paints the
 * grid.
 *
 * No `ssr: false` here, unlike the palette above: both are portalled surfaces
 * with no server-rendered output, and `ssr: false` would exclude them from the
 * server graph entirely rather than merely moving code out of the initial
 * chunk. They are also left mounted — no deferred-mount latch — because the
 * preview holds the invite poll and the editor holds unsaved draft state;
 * unmounting between opens would throw that away. {@link warmEventSurfaceChunks}
 * fetches both chunks once the app has settled so the click that opens them
 * lands on an already-parsed module instead of a network round-trip.
 */
const EventPreview = dynamic(loadEventPreview)
const EventEditor = dynamic(loadEventEditor)

type IdleCapableWindow = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number },
  ) => number
  cancelIdleCallback?: (handle: number) => void
}

/**
 * Fetches the event preview and editor chunks when the browser is idle, so the
 * first click on an event does not wait for them.
 *
 * Idle rather than immediate: the click cannot arrive before the grid has
 * painted, and loading ~3,200 lines during the initial render would compete
 * with the work that decides what the user sees first. The timeout is a
 * ceiling for browsers that never report idle.
 */
function warmEventSurfaceChunks() {
  const warm = () => {
    // Both loaders are the same functions `dynamic()` was given, so warming
    // here fills the module registry the wrapper will read from.
    void loadEventPreview()
    void loadEventEditor()
  }

  const idleWindow = window as IdleCapableWindow
  const idleHandle = idleWindow.requestIdleCallback
    ? idleWindow.requestIdleCallback(warm, { timeout: 4000 })
    : null
  const timerHandle = idleHandle === null ? window.setTimeout(warm, 1500) : null

  return () => {
    if (idleHandle !== null) idleWindow.cancelIdleCallback?.(idleHandle)
    if (timerHandle !== null) window.clearTimeout(timerHandle)
  }
}

/**
 * The view chunks, keyed by the view that selects them (`four-day` is the week
 * grid with a different day count, so it shares its chunk).
 *
 * Exported so the app page can pull the saved default's chunk while it is
 * still showing the loading screen. A `next/dynamic` component that has not
 * resolved renders its loading fallback, which is `null` — so a chunk fetched
 * after the calendar mounts leaves the middle column empty, and black in dark
 * mode, for the length of the request. Preloading turns that into a microtask.
 */
export const CALENDAR_VIEW_CHUNKS: Record<
  CalendarViewTypeValue,
  () => Promise<unknown>
> = {
  day: loadDayView,
  week: loadWeekView,
  'four-day': loadWeekView,
  month: loadMonthView,
  year: loadYearView,
}

interface CalendarProps {
  className?: string
}

export default function Calendar({ className, ..._props }: CalendarProps) {
  const {
    navigation: router,
    session: sessionState,
    request,
  } = useCalendarHost()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  // Mobile Form only (ADR-0019): the left drawer holding the sidebar content.
  // Opened by the hamburger button, which exists only below the md breakpoint.
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  // Deferred mount: the palette chunk is only fetched the first time the
  // user opens it, and stays mounted afterwards to keep its conversation.
  const [aiPaletteOpen, setAiPaletteOpen] = useState(false)
  const [aiPaletteMounted, setAiPaletteMounted] = useState(false)
  const [aiPaletteMode, setAiPaletteMode] = useState<'palette' | 'search'>(
    'palette',
  )
  const openSearchPalette = useCallback(() => {
    setAiPaletteMode('search')
    setAiPaletteMounted(true)
    setAiPaletteOpen(true)
  }, [])
  const [date, setDate] = useState(new Date())
  const [view, setView] = useState<ViewType>('week')
  const [eventEditorOpen, setEventEditorOpen] = useState(false)
  const [editorAnchorEl, setEditorAnchorEl] = useState<HTMLElement | null>(null)
  const [editorAnchorRect, setEditorAnchorRect] = useState<DOMRect | null>(null)
  // The editor is replacing the preview at the same anchor, so its entrance
  // animation is suppressed — the swap should read as one panel changing
  // content, not a flash of two popovers.
  const [editorReplacesPreview, setEditorReplacesPreview] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const { events, setEvents, calendars } = useCalendar()
  const [selectedCategoryFilters, setSelectedCategoryFilters] = useState<
    string[]
  >([])
  const calendarRef = useRef<HTMLDivElement>(null)
  const [language, setLanguage] = useLanguage()

  // Warms the event preview and editor chunks off the critical path. Declared
  // here rather than inside an existing effect so its only job is visible.
  useEffect(() => warmEventSurfaceChunks(), [])
  const t = translations[language]
  const { settings, loading: settingsLoading, updateSettings } = useSettings()
  const { setTheme } = useTheme()
  const {
    upsertEvent,
    deleteEvent,
    refreshEvents,
    setEventsRange,
    eventsError,
  } = useEvents()
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
  useEffect(() => {
    if (isCalendarView(view))
      setEventsRange(calendarLoadRange(date, view, timezone))
  }, [date, view, timezone, setEventsRange])
  const handleTimezoneChange = (tz: string) => {
    const validTz = getValidTimezone(tz)
    setTimezone(validTz)
    updateSettings({ timezone: validTz })
  }
  const [previewEvent, setPreviewEvent] = useState<CalendarEvent | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewAnchorRect, setPreviewAnchorRect] = useState<DOMRect | null>(
    null,
  )
  const [previewAnchorEl, setPreviewAnchorEl] = useState<HTMLElement | null>(
    null,
  )
  const [focusUserProfileSection, setFocusUserProfileSection] =
    useState<AccountSection | null>(null)
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
  // "All events" is only offered on the series' first occurrence (or a raw
  // master row, which IS the series root). Mirrors the save-scope gating in
  // event-editor.tsx.
  const rangeMoveCanAll =
    !!pendingRangeMove &&
    ((!!pendingRangeMove.event.rrule &&
      !pendingRangeMove.event.seriesId &&
      !pendingRangeMove.event.recurrenceId) ||
      pendingRangeMove.event.isFirstInstance === true)
  const [deleteScope, setDeleteScope] = useState<
    'single' | 'following' | 'all'
  >('single')
  const [pendingRemoveInvite, setPendingRemoveInvite] =
    useState<CalendarEvent | null>(null)
  const [removeInviteConfirmOpen, setRemoveInviteConfirmOpen] = useState(false)
  const [pendingInvites, setPendingInvites] = useState<{
    eventId: string
    emails: string[]
    /** Which occurrences the participants apply to, for a recurring event. */
    scope?: 'single' | 'following' | 'all'
  } | null>(null)
  const { data: session } = sessionState
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
        // `?? null`, not `|| null`: 0 is a real reminder ("at the event's
        // start") and must survive a drag-move.
        notificationMinutes: updatedEvent.notification ?? null,
        emailReminder: updatedEvent.emailReminder === true,
        color: updatedEvent.color || null,
        categoryId: updatedEvent.calendarId || null,
        apply_to: scope,
        split_id: splitId ?? undefined,
        timezone,
      },
      oldSeriesId ? new Set([oldSeriesId]) : undefined,
    ).catch(() => {})
  }

  const confirmRangeMove = (requested: 'single' | 'following' | 'all') => {
    if (!pendingRangeMove) return
    // Belt guard: never commit a scope that isn't offered.
    const scope = requested === 'all' && !rangeMoveCanAll ? 'single' : requested
    commitRangeMove(
      pendingRangeMove.event,
      pendingRangeMove.startDate,
      pendingRangeMove.endDate,
      scope,
    )
    setRangeMoveOpen(false)
    setPendingRangeMove(null)
  }

  // Set only by the month grid, which has no hour under the cursor to read.
  // Everywhere else the clicked time slot decides, and this stays false.
  const [quickCreateAllDay, setQuickCreateAllDay] = useState(false)
  const [quickCreateStartTime, setQuickCreateStartTime] = useState<Date | null>(
    null,
  )
  const [quickCreateEndTime, setQuickCreateEndTime] = useState<Date | null>(
    null,
  )
  /**
   * Live draft range coming back from the editor's date/time fields while
   * creating. Takes precedence over the committed quick-create range so the
   * selection box follows the user's edits in real time (CORE-191).
   */
  const [createDraftRange, setCreateDraftRange] = useState<{
    start: Date
    end: Date
    isAllDay?: boolean
  } | null>(null)

  const [defaultView, setDefaultView] = useState<CalendarViewTypeValue>(
    (settings.defaultView as CalendarViewTypeValue) ?? 'week',
  )
  const handleDefaultViewChange = (view: CalendarViewTypeValue) => {
    setDefaultView(view)
    setView(view)
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

  const settingsInitializedRef = useRef(false)
  // Seeded from the loading state, not hard-coded `false`. A caller that
  // mounts the calendar only once the data has settled — the app page waits,
  // so its loading screen is the only one — must not render a frame of this
  // one on the way in. Mounted before the data arrives (nothing does that
  // today) the seed is `false` and the layout effect below opens the gate as
  // soon as it settles, exactly as before.
  const [settingsViewReady, setSettingsViewReady] = useState(
    settingsLoading !== 'loading',
  )

  useEffect(() => {
    applyCalendarColor(settings.calendarColor)
  }, [settings.calendarColor])

  useEffect(() => () => applyCalendarColor(undefined), [])

  useLayoutEffect(() => {
    if (settingsLoading === 'loading' || settingsInitializedRef.current) return
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
    setSettingsViewReady(true)
  }, [settings, settingsLoading])

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

  // Cmd/Ctrl+K opens the command palette from anywhere, including inside
  // inputs — that is the universal command-palette convention, so it lives
  // outside the plain-key shortcut handler below (which correctly defers to
  // inputs).
  //
  // Not gated on AI_ENABLED: the palette is how this app is driven without a
  // mouse (views, periods, go-to-date, create), and that has to work on a
  // deployment with no model configured. The palette hides its AI modes there.
  useEffect(() => {
    const handlePaletteKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setAiPaletteMode('palette')
        setAiPaletteMounted(true)
        setAiPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handlePaletteKey)
    return () => window.removeEventListener('keydown', handlePaletteKey)
  }, [])

  useEffect(() => {
    if (!enableShortcuts) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        document.activeElement?.closest(
          '[role="dialog"], [role="alertdialog"]',
        ) ||
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement?.getAttribute('contenteditable') === 'true'
      ) {
        return
      }

      switch (e.key) {
        case 'n':
        case 'N': {
          e.preventDefault()
          // An open dialog/sheet would sit on top of the editor this
          // shortcut opens (and its overlay would swallow the clicks), so
          // dismiss any open Radix layer first. A synthetic Escape reuses
          // each surface's own close path (onOpenChange, focus restore)
          // instead of this component reaching into their open states.
          const openOverlay = document.querySelector(
            '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
          )
          if (openOverlay) {
            document.dispatchEvent(
              new KeyboardEvent('keydown', {
                key: 'Escape',
                bubbles: true,
                cancelable: true,
              }),
            )
          }
          setSelectedEvent(null)
          // Shared quick-create path: leaves non-calendar views (analytics,
          // settings) for the user's default view and navigates to the
          // period containing the draft.
          handleTimeRangeSelect(new Date())
          break
        }
        case '/': {
          e.preventDefault()
          openSearchPalette()
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
  }, [enableShortcuts, openSearchPalette, view])

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev)
  }

  const handleDateSelect = (date: Date) => {
    setDate(date)
    setSidebarDate(date)
  }

  const handleViewChange = (newView: ViewType) => {
    setView(newView)
  }

  const handleNavigateToView = (target: 'analytics' | 'settings') => {
    if (target === 'settings') {
      setSettingsOpen(true)
      return
    }
    setView(target)
  }

  const handleTodayClick = () => {
    const today = toCalendarDate(new Date(), timezone)
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
    // The popover attaches level with the CLICK, not the block's midpoint —
    // on a tall week-view block the midpoint can be half a screen from the
    // cursor. One rule for every view; the anchor keeps the block's width so
    // side space is judged from its real edges.
    if (anchorEl && clientX !== undefined && clientY !== undefined) {
      setPreviewAnchorRect(
        anchorRectForClick(anchorEl.getBoundingClientRect(), clientX, clientY),
      )
    } else if (clientX !== undefined && clientY !== undefined) {
      setPreviewAnchorRect(
        DOMRect.fromRect({ x: clientX, y: clientY, width: 0, height: 0 }),
      )
    } else {
      setPreviewAnchorRect(anchorEl?.getBoundingClientRect() ?? null)
    }
    setPreviewOpen(true)
  }

  const [navigationPreview, setNavigationPreview] =
    useState<CalendarEvent | null>(null)
  const openNavigationPreview = useCallback((anchor: HTMLElement | null) => {
    setPreviewAnchorEl(anchor)
    setPreviewAnchorRect(anchor?.getBoundingClientRect() ?? null)
    setPreviewOpen(true)
    setNavigationPreview(null)
  }, [])
  useEventPreviewNavigation(
    navigationPreview,
    calendarRef,
    openNavigationPreview,
    timezone,
  )

  const handleNavigateAndPreview = (event: CalendarEvent) => {
    const eventId = event.id
    const realEvent = events.find((e) => e.id === eventId) ?? event
    setDate(
      realEvent.isAllDay
        ? new Date(realEvent.startDate)
        : toCalendarDate(new Date(realEvent.startDate), timezone),
    )
    setView(defaultView as ViewType)
    setPreviewOpen(false)
    setPreviewAnchorEl(null)
    setPreviewAnchorRect(null)
    setPreviewEvent(realEvent)
    setNavigationPreview({ ...realEvent, id: eventId })
  }

  const handleEventAdd = (event: CalendarEvent) => {
    const newEvent = {
      ...event,
      id: event.id || uuid(),
    }

    setEvents((prevEvents) => [...prevEvents, newEvent])
    void upsertEvent({
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
      emailReminder: newEvent.emailReminder === true,
      categoryId: newEvent.calendarId || null,
      rrule: newEvent.rrule ?? null,
      timezone,
    })
    toast(t.eventCreated)
    setEventEditorOpen(false)
    setSelectedEvent(null)
    setQuickCreateStartTime(null)
    setQuickCreateEndTime(null)
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
        emailReminder: updatedEvent.emailReminder === true,
        categoryId: updatedEvent.calendarId || null,
        rrule: updatedEvent.rrule ? updatedEvent.rrule : undefined,
        apply_to: applyTo,
        split_id: splitId ?? undefined,
        timezone,
      },
      oldSeriesId ? new Set([oldSeriesId]) : undefined,
    )
    toast(t.eventUpdated)
    setEventEditorOpen(false)
    setSelectedEvent(null)
    setQuickCreateStartTime(null)
    setQuickCreateEndTime(null)
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

    setEventEditorOpen(false)
    setSelectedEvent(null)
    setPreviewOpen(false)
    setDeleteConfirmOpen(false)
    setPendingDeleteEvent(null)
    try {
      await deleteEvent(deletedEvent.id, applyTo, timezone)
      toast.success(t.eventDeleted, { description: deletedEvent.title })
      await deleteBookmarkByEvent(deletedEvent.id).catch(() => {})
    } catch {
      // The data provider rolls back and reports failed writes.
    }
  }

  const reAddInviteToCalendar = async (
    targetEvent: CalendarEvent,
    inviteToken?: string,
  ) => {
    if (inviteToken) {
      // Session-authenticated: undoing a removal must work even after the
      // emailed link expired, because the grant outlives the link (ADR-0013).
      await request('/api/invites/self', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteToken,
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
      await request(
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
      setQuickCreateEndTime(null)
      // Hand the preview's anchor to the editor. Without this the editor
      // falls back to querying [data-event-id] — which for a multi-day event
      // returns the FIRST rendered segment, not the one the user clicked, so
      // editing from day 2 opened the popover at day 1's block.
      setEditorAnchorEl(previewAnchorEl)
      setEditorAnchorRect(previewAnchorRect)
      setEditorReplacesPreview(previewOpen)
      setEventEditorOpen(true)
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

  const handleTimeRangeSelect = (
    startTime: Date,
    endTime?: Date,
    options?: { allDay?: boolean },
  ) => {
    setQuickCreateAllDay(options?.allDay === true)
    setQuickCreateStartTime(startTime)
    // Always a concrete range: the views render it as the blue selection box
    // the editor popover anchors to (CORE-191). The default 30-minute range
    // is clamped to the start's own day — creating at 23:40 must not spill
    // into a day that may not even be on screen.
    setQuickCreateEndTime(
      endTime ?? defaultCreateRange(startTime, timezone).end,
    )

    // Creating from the sidebar or the N shortcut while viewing another
    // week/month left the blue box (and the editor's anchor) outside the
    // visible period. Navigate to the period that contains the new event.
    // Only for those entry points: a drag passes endTime and is by
    // definition already in view — and in the four-day view, whose window
    // starts at `date`, navigating on drag would shift the window under
    // the user's cursor.
    if (endTime === undefined) setDate(toCalendarDate(startTime, timezone))

    // Those same entry points also exist on non-calendar screens (analytics,
    // settings), where the editor would open over a page with no grid to
    // anchor to. Return to the user's preferred calendar view so the
    // selection box and the created event are visible.
    if (!isCalendarView(view)) {
      setView(isCalendarView(defaultView) ? defaultView : 'week')
    }

    setSelectedEvent(null)
    setEditorAnchorEl(null)
    setEditorAnchorRect(null)
    setEditorReplacesPreview(false)
    setPreviewOpen(false)
    setPreviewAnchorRect(null)
    setPreviewAnchorEl(null)
    setEventEditorOpen(true)
  }

  /**
   * A day's label was clicked in the month or week grid: show that day.
   *
   * The date is set before the view, so the day view lands on the day that was
   * clicked rather than on whatever the grid was anchored to.
   */
  const handleDayLabelClick = useCallback((day: Date) => {
    setDate(day)
    setView('day')
  }, [])

  /**
   * Month view, empty cell clicked: create on that day.
   *
   * No anchor element and no anchor rect, the same as creating from the sidebar
   * or the N shortcut — the editor places itself, and the cell is already
   * covered by the selection box it anchors to. The range spans the day from
   * midnight to its last millisecond so the box covers one day: the month grid
   * treats an end at midnight as excluding that day.
   */
  const handleMonthCellClick = (day: Date) => {
    const start = new Date(day)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setHours(23, 59, 59, 999)
    handleTimeRangeSelect(start, end, { allDay: true })
  }

  const handleInvitesAdded = (
    eventId: string,
    emails: string[],
    scope?: 'single' | 'following' | 'all',
  ) => {
    if (emails.length === 0) return
    setPendingInvites({ eventId, emails, scope })
  }

  const handleSendInvites = async () => {
    if (!pendingInvites) return
    const { eventId, emails, scope } = pendingInvites
    setPendingInvites(null)
    try {
      const response = await request('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, emails, scope, timezone }),
      })
      if (!response.ok) {
        const message = await response
          .json()
          .then((d) => d?.error)
          .catch(() => null)
        throw new Error(message ?? 'failed')
      }
      await refreshEventInvites(eventId)
      toast.success(t.invitationsSent)
    } catch (error) {
      toast.error(
        error instanceof Error && error.message !== 'failed'
          ? error.message
          : t.invitationSendFailed,
      )
    }
  }

  const handleSkipInvites = async () => {
    if (!pendingInvites) return
    const { eventId, emails, scope } = pendingInvites
    setPendingInvites(null)
    try {
      const response = await request('/api/invites/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, emails, scope, timezone }),
      })
      if (!response.ok) throw new Error('failed')
      await refreshEventInvites(eventId)
    } catch {
      toast.error(t.addParticipantsFailed)
    }
  }

  const refreshEventInvites = async (eventId: string) => {
    try {
      const response = await request(
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

  // The committed create range, shown as the blue selection box the editor
  // popover anchors to (CORE-191). Only while creating — editing anchors to
  // the event block itself.
  const createSelectionRange = useMemo(() => {
    if (!eventEditorOpen || selectedEvent) return null
    // The editor's draft (live date/time fields) wins over the committed
    // quick-create range, so the box follows the user's edits.
    if (createDraftRange) {
      const { start, end, isAllDay } = createDraftRange
      // Tolerate inverted input while the user is mid-edit.
      return start <= end
        ? { start, end, isAllDay }
        : { start: end, end: start, isAllDay }
    }
    if (!quickCreateStartTime) return null
    return {
      start: quickCreateStartTime,
      end:
        quickCreateEndTime ??
        defaultCreateRange(quickCreateStartTime, timezone).end,
      isAllDay: quickCreateAllDay,
    }
  }, [
    eventEditorOpen,
    selectedEvent,
    quickCreateStartTime,
    quickCreateEndTime,
    createDraftRange,
    quickCreateAllDay,
    timezone,
  ])

  useNotifications(events)

  // Settings are fetched after the calendar mounts. Do not render the default
  // week view while that request is in flight, otherwise users briefly see a
  // week grid before their saved view is applied.
  if (!settingsViewReady) {
    return <AuthWaitingLoading />
  }

  return (
    <div className={className}>
      <div className="relative flex h-dvh overflow-hidden bg-background">
        {}
        <Sidebar
          onCreateEvent={() => {
            setSelectedEvent(null)
            // Same path as drag-to-create: a synthetic 30-minute range shows
            // the same blue box, and the editor anchors to it (CORE-191).
            handleTimeRangeSelect(new Date())
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
        />

        <MobileSidebarDrawer
          open={mobileDrawerOpen}
          onOpenChange={setMobileDrawerOpen}
          onCreateEvent={() => {
            setSelectedEvent(null)
            handleTimeRangeSelect(new Date())
          }}
          onDateSelect={handleDateSelect}
          onViewChange={handleViewChange}
          onEventClick={(event) => {
            handleNavigateAndPreview(event)
          }}
          language={language}
          selectedDate={sidebarDate}
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

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {' '}
          {/*
            `overflow-x-auto` is the last-resort defence: when the window is
            narrower than the header's controls, the row scrolls instead of
            clipping the trailing buttons out of reach. With no overflow it
            renders nothing — no scrollbar, no layout change. Every popup here
            (select, command palette, menus) is portalled to <body>, so the
            overflow container cannot clip them.
          */}
          <header className="flex items-center px-4 h-16 border-b relative z-40 bg-background overflow-x-auto">
            {/* Cover strip for the right rail's slice of the header border.
                The rail has no mobile surface, so neither does this. */}
            <div className="pointer-events-none absolute right-0 bottom-0 h-px w-14 bg-background max-md:hidden" />
            {/*
              `min-w-0` on the left cluster and `shrink-0` on the controls
              inside it. The header is one fixed-height non-wrapping row, so
              whichever child could not shrink pushed the rest out: "Today" is
              "I dag" in Norwegian but "Секојдневно"-length words live in this
              row too, and the long date beside it is the part that should give
              way, not the navigation.
            */}
            <div className="flex min-w-0 items-center space-x-4 max-md:space-x-2">
              {/*
                Two mutually exclusive leading buttons: the desktop collapse
                toggle and the mobile hamburger that opens the drawer
                (ADR-0019). Swapped by breakpoint, never both visible.
              */}
              <Button
                variant="outline"
                onClick={toggleSidebar}
                size="sm"
                className="shrink-0 max-md:hidden"
              >
                <PanelLeft />
              </Button>
              <Button
                variant="outline"
                onClick={() => setMobileDrawerOpen(true)}
                size="sm"
                className="shrink-0 md:hidden"
                aria-label={t.menu}
              >
                <Menu />
              </Button>
              {/*
                The Mobile Form's top bar is a single iconified row: "today"
                becomes an icon and the prev/next arrows disappear —
                navigation happens via "today" and the drawer's mini calendar.
              */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleTodayClick}
                className="shrink-0 max-md:hidden"
              >
                {t.today}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTodayClick}
                className="shrink-0 md:hidden"
                aria-label={t.today}
              >
                <CalendarCheck />
              </Button>
              {view !== 'analytics' && (
                <>
                  <div className="flex shrink-0 items-center space-x-1 max-md:hidden">
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
                  <span className="min-w-0 truncate text-lg max-md:text-base">
                    {formatDateDisplay(date)}
                  </span>
                </>
              )}
            </div>

            <div className="ml-auto flex shrink-0 items-center space-x-2">
              <TooltipProvider delayDuration={300}>
                <div className="relative z-50 shrink-0">
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
                    {/*
                    `min-w-` not `w-`: the longest option is "Four Days" in
                    English but "Τέσσερις Ημέρες" in Greek and "Секоја година"
                    in Macedonian. At a fixed 100px the trigger clipped the
                    selected view — the one label the user needs to read to know
                    which view they are in. 100px stays the floor so the control
                    does not shrink to the width of "Day".
                  */}
                    <SelectTrigger className="min-w-[100px]">
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
                {/* Unified command menu, also available via Cmd/Ctrl+K. */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full h-8 w-8"
                      aria-label={t.searchEvents}
                      onClick={openSearchPalette}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t.searchEvents} · Ctrl / ⌘ K</TooltipContent>
                </Tooltip>
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        {/* Not part of the Mobile Form's single-row top bar
                          (ADR-0019): hamburger, date, today, view, search,
                          profile. Help stays desktop-only. */}
                        <Button
                          variant="outline"
                          size="icon"
                          className="rounded-full h-8 w-8 max-md:hidden"
                          aria-label={t.help}
                        >
                          <CircleHelp className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>{t.help}</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end">
                    {isSignedIn ? (
                      <DropdownMenuItem onClick={() => router.push('/landing')}>
                        <House className="mr-2 h-4 w-4" />
                        {t.home}
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem
                      onClick={() =>
                        router.openExternal(APP_CONFIG.contact.statusPageUrl)
                      }
                    >
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      {t.status}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        router.openExternal(
                          `mailto:${APP_CONFIG.contact.feedbackEmail}`,
                        )
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
                  onNavigateToView={handleNavigateToView}
                />
              </TooltipProvider>
            </div>
          </header>
          <div
            className="relative flex-1 overflow-auto pr-14 max-md:pr-0"
            ref={calendarRef}
          >
            {eventsError && (
              <div
                className="sticky top-0 z-30 bg-background/95 p-2 text-center text-sm"
                role="alert"
              >
                <Button variant="ghost" onClick={() => void refreshEvents()}>
                  {t.aiSearchRetry}
                </Button>
              </div>
            )}
            {view === 'day' && (
              <DayView
                date={date}
                events={eventsByCategory}
                onEventClick={handleEventClick}
                onTimeSlotClick={handleTimeRangeSelect}
                config={viewConfig}
                onEditEvent={handleEventEdit}
                onDeleteEvent={(event) => handleEventDelete(event.id)}
                onBookmarkEvent={toggleBookmark}
                onEventDrop={handleEventDrop}
                onBackToCalendar={() => setView(defaultView)}
                selection={createSelectionRange}
              />
            )}
            {view === 'week' && (
              <WeekView
                date={date}
                events={eventsByCategory}
                onEventClick={handleEventClick}
                onTimeSlotClick={handleTimeRangeSelect}
                onDayHeaderClick={handleDayLabelClick}
                config={viewConfig}
                onEditEvent={handleEventEdit}
                onDeleteEvent={(event) => handleEventDelete(event.id)}
                onBookmarkEvent={toggleBookmark}
                onEventDrop={handleEventDrop}
                selection={createSelectionRange}
              />
            )}
            {view === 'four-day' && (
              <WeekView
                date={date}
                events={eventsByCategory}
                onEventClick={handleEventClick}
                onTimeSlotClick={handleTimeRangeSelect}
                onDayHeaderClick={handleDayLabelClick}
                config={viewConfig}
                daysToShow={4}
                fixedStartDate={date}
                onEditEvent={handleEventEdit}
                onDeleteEvent={(event) => handleEventDelete(event.id)}
                onBookmarkEvent={toggleBookmark}
                onEventDrop={handleEventDrop}
                selection={createSelectionRange}
              />
            )}
            {view === 'month' && (
              <MonthView
                date={date}
                events={eventsByCategory}
                onDayNumberClick={handleDayLabelClick}
                onCellClick={handleMonthCellClick}
                onEventClick={handleEventClick}
                config={viewConfig}
                selection={createSelectionRange}
                scrollContainerRef={calendarRef}
              />
            )}
            {view === 'year' && (
              <YearView
                date={date}
                events={eventsByCategory}
                onDayHeaderClick={handleDayLabelClick}
                onEventClick={handleEventClick}
                config={viewConfig}
                selection={createSelectionRange}
                scrollContainerRef={calendarRef}
              />
            )}
            {view === 'analytics' && (
              <AnalyticsView
                events={events}
                onCreateEvent={(startDate) => {
                  setSelectedEvent(null)
                  // Route through the shared quick-create path: it switches
                  // back to the user's calendar view and navigates to the
                  // period containing the draft, so the editor has a visible
                  // grid to anchor to instead of opening over the report.
                  handleTimeRangeSelect(startDate)
                }}
                onBackToCalendar={() => setView(defaultView)}
              />
            )}
          </div>
        </div>

        {/* Mobile Form (ADR-0019): the floating create button — the mobile
            stand-in for the sidebar's Create Event button and drag-to-create,
            both of which have no surface below the md breakpoint. Hidden on
            the analytics report, which has its own create affordance. */}
        {view !== 'analytics' && (
          <Button
            size="icon"
            className="fixed right-4 bottom-4 z-40 hidden size-12 rounded-full shadow-lg max-md:flex"
            aria-label={t.createEvent}
            onClick={() => {
              setSelectedEvent(null)
              handleTimeRangeSelect(new Date())
            }}
          >
            <Plus className="size-5" />
          </Button>
        )}

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

        <EventEditor
          open={eventEditorOpen}
          onOpenChange={(open) => {
            setEventEditorOpen(open)
            if (!open) {
              // Clearing the range removes the blue anchor box in the views.
              setQuickCreateStartTime(null)
              setQuickCreateEndTime(null)
              setCreateDraftRange(null)
              setEditorAnchorEl(null)
              setEditorAnchorRect(null)
              setEditorReplacesPreview(false)
            }
          }}
          onEventAdd={handleEventAdd}
          onEventUpdate={(event, applyTo) => handleEventUpdate(event, applyTo)}
          onEventDelete={(eventId, applyTo) =>
            handleEventDelete(eventId, applyTo)
          }
          onInvitesAdded={handleInvitesAdded}
          initialDate={quickCreateStartTime || date}
          initialEndDate={quickCreateEndTime}
          initialIsAllDay={quickCreateAllDay}
          onDraftRangeChange={setCreateDraftRange}
          event={selectedEvent}
          config={viewConfig}
          replacesPreview={editorReplacesPreview}
          anchorElement={editorAnchorEl}
          anchorRect={editorAnchorRect}
          scrollContainerRef={calendarRef}
        />

        <Dialog
          open={!!pendingInvites}
          onOpenChange={(open) => {
            if (!open) setPendingInvites(null)
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t.sendInvitationsTitle}</DialogTitle>
            </DialogHeader>
            {/*
              One interpolated sentence, not English pluralisation glued
              together in JSX. The `+ 's'` branch produced "1 participants" in
              every locale that does not form plurals that way, which is most
              of them.
            */}
            <p className="text-sm text-muted-foreground">
              {t.sendInvitationsDescription.replace(
                '{count}',
                String(pendingInvites?.emails.length ?? 0),
              )}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={handleSkipInvites}>
                {t.notNow}
              </Button>
              <Button onClick={handleSendInvites}>{t.send}</Button>
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
              {!rangeMoveCanAll && (
                <div className="flex items-center gap-2">
                  <RadioGroupItem
                    value="following"
                    id="range-move-scope-following"
                  />
                  <Label htmlFor="range-move-scope-following">
                    {t.repeatScopeFollowing}
                  </Label>
                </div>
              )}
              {rangeMoveCanAll && (
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="all" id="range-move-scope-all" />
                  <Label htmlFor="range-move-scope-all">
                    {t.repeatScopeAll}
                  </Label>
                </div>
              )}
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
                  setDeleteScope(value as 'single' | 'following' | 'all')
                }
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="single" id="delete-scope-single" />
                  <Label htmlFor="delete-scope-single">
                    {t.repeatDeleteThisOccurrence}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem
                    value="following"
                    id="delete-scope-following"
                  />
                  <Label htmlFor="delete-scope-following">
                    {t.repeatScopeFollowing}
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

        {/* Mounted on first open only (chunk is lazy); kept mounted after so
            the conversation survives close/reopen within the session. */}
        {aiPaletteMounted && (
          <AiCommandPalette
            open={aiPaletteOpen}
            initialMode={aiPaletteMode}
            categoryIds={selectedCategoryFilters}
            timezone={timezone}
            onOpenChange={setAiPaletteOpen}
            onEventsMutated={() => void refreshEvents()}
            actions={{
              setView: (v) => setView(v),
              goToToday: handleTodayClick,
              createEvent: () => {
                setSelectedEvent(null)
                handleTimeRangeSelect(new Date())
              },
              openAnalytics: () => handleNavigateToView('analytics'),
              openSettings: () => handleNavigateToView('settings'),
              previousPeriod: handlePrevious,
              nextPeriod: handleNext,
              goToDate: handleDateSelect,
              // Search spans unloaded periods. Resolve complete, authorized
              // details before opening the preview or edit controls.
              goToEvent: async (hit) => {
                try {
                  const response = await request(
                    `/api/events?${new URLSearchParams({ id: hit.id, tz: timezone })}`,
                  )
                  if (!response.ok) throw new Error('Event unavailable')
                  const body = await response.json()
                  handleNavigateAndPreview(eventDataToCalendarEvent(body.event))
                } catch {
                  toast.error(t.aiSearchFailed)
                }
              },
            }}
          />
        )}
      </div>
    </div>
  )
}
