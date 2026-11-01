'use client'

import { useCalendarHost } from '@zntr/calendar/host'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@zntr/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from '@zntr/ui/dialog'
import {
  Download,
  Upload,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  FileCode2,
  FileSpreadsheet,
  FileUp,
  Link2,
  LoaderCircle,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@zntr/ui/tabs'
import { translations, useLanguage } from '@zntr/i18n/calendar'
import {
  collapseSeriesForExport,
  generateICSFile,
  parseICS,
} from '#calendar/lib/ics'
import { Checkbox } from '@zntr/ui/checkbox'
import type { CalendarEvent } from '../calendar'
import { Button } from '@zntr/ui/button'
import { Input } from '@zntr/ui/input'
import { Label } from '@zntr/ui/label'
import type { CalendarColor } from '#calendar/lib/calendar-colors'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  useData,
  useCategories,
  useBookmarks,
  useCountdowns,
  useSettings,
} from '#calendar/components/providers/data-provider'
import type {
  CategoryData,
  BookmarkData,
  CountdownData,
  SettingsData,
} from '#calendar/lib/api-client'

interface ImportExportProps {
  events: CalendarEvent[]
  onImportEvents: (events: CalendarEvent[]) => void
}

interface ImportedCategory {
  id: string
  name: string
  color: string
  keywords?: string[]
}

interface AppSettingsSnapshot {
  language?: string
  firstDayOfWeek?: number
  timezone?: string
  defaultView?: string
  enableShortcuts?: boolean
  timeFormat?: '24h' | '12h'
  theme?: string
  calendarColor?: CalendarColor
}

/**
 * Event shape written to a JSON backup.
 *
 * Two deliberate reductions versus the in-memory `CalendarEvent`:
 *
 * 1. `invites[].userImage` (and the invite plumbing: tokens, delivery flags) is
 *    dropped. An avatar URL is a third-party CDN link that will rot, it bloats
 *    the file, and a backup does not need it to restore the calendar. Only the
 *    invitee's email and RSVP status are kept, which is what re-creating an
 *    invite actually requires.
 * 2. A recurring series is written once — the master row with its rrule and
 *    exdates — rather than every expanded occurrence. Occurrences are derived
 *    data; exporting them made the file grow with the expansion window and,
 *    on import, produced one standalone event per occurrence. Single-instance
 *    edits are the exception: they are real stored rows, so each is kept with
 *    its seriesId/recurrenceId so it can be re-attached.
 */
interface JsonBackupEvent {
  id: string
  title: string
  startDate: string
  endDate: string
  isAllDay: boolean
  description?: string
  location?: string
  notification?: number
  color?: string
  calendarId?: string
  participants?: string[]
  rrule?: string | null
  exdate?: string[] | null
  /** Present only on single-instance edits of a series. */
  seriesId?: string | null
  recurrenceId?: string | null
  isOverride?: boolean
  invites?: Array<{
    email: string
    status: string
  }>
}

/**
 * What `normalizeImportedEvent` accepts: an ics/csv parse result (dates as
 * `Date`) or a JSON-backup row (dates as ISO strings, invites reduced to email
 * plus status).
 */
type ImportableEvent = {
  id?: string
  title?: string
  startDate?: Date | string
  endDate?: Date | string
  isAllDay?: boolean
  description?: string
  location?: string
  /** Minutes before the start; null or absent means no reminder. */
  notification?: number | null
  color?: string
  calendarId?: string
  participants?: string[]
  rrule?: string | null
  exdate?: string[] | null
  seriesId?: string | null
  recurrenceId?: string | null
  isOverride?: boolean
  invites?: Array<{ email?: string; status?: string }>
}

function toBackupEvent(event: CalendarEvent): JsonBackupEvent {
  const invites = (event.invites ?? [])
    .map((invite) => ({ email: invite.email, status: invite.status }))
    .filter((invite) => !!invite.email)

  return {
    id: event.id,
    title: event.title,
    startDate: new Date(event.startDate).toISOString(),
    endDate: new Date(event.endDate).toISOString(),
    isAllDay: Boolean(event.isAllDay),
    ...(event.description ? { description: event.description } : {}),
    ...(event.location ? { location: event.location } : {}),
    ...(event.notification !== null && event.notification !== undefined
      ? { notification: event.notification }
      : {}),
    ...(event.color ? { color: event.color } : {}),
    ...(event.calendarId ? { calendarId: event.calendarId } : {}),
    ...(event.participants?.length ? { participants: event.participants } : {}),
    ...(event.rrule ? { rrule: event.rrule.replace(/^RRULE:/i, '') } : {}),
    ...(event.exdate?.length ? { exdate: event.exdate } : {}),
    ...(event.isOverride
      ? {
          seriesId: event.seriesId ?? null,
          recurrenceId: event.recurrenceId ?? null,
          isOverride: true,
        }
      : {}),
    ...(invites.length ? { invites } : {}),
  }
}

/**
 * Collapses expanded occurrences into their parent series and strips derived
 * fields. Uses the same anchor rule as the ics export: the earliest occurrence
 * becomes the exported row so its rrule regenerates the same set.
 */
function toBackupEvents(events: CalendarEvent[]): JsonBackupEvent[] {
  const collapsed = collapseSeriesForExport(
    events as unknown as Parameters<typeof collapseSeriesForExport>[0],
  ) as unknown as CalendarEvent[]
  return collapsed.map(toBackupEvent)
}

interface JsonBackupPayloadV2 {
  format: 'one-calendar-json-v2'
  exportedAt: string
  data: {
    events: JsonBackupEvent[]
    calendars: ImportedCategory[]
    eventCategoryMap: Record<string, string>
    bookmarks: unknown[]
    countdowns: unknown[]
    settings: AppSettingsSnapshot
  }
}

export default function ImportExport({
  events,
  onImportEvents: _onImportEvents,
}: ImportExportProps) {
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState('ics')
  const [importTab, setImportTab] = useState('file')
  const [importUrl, setImportUrl] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [includeCompleted, setIncludeCompleted] = useState(true)
  const [dateRangeOption, setDateRangeOption] = useState('all')
  const [isLoading, setIsLoading] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string>('')
  const [language] = useLanguage()
  const { request, saveFile, readExternal } = useCalendarHost()
  const t = translations[language]
  const { refresh } = useData()
  const { categories } = useCategories()
  const { bookmarks } = useBookmarks()
  const { countdowns } = useCountdowns()
  const { settings } = useSettings()

  const [importCalendarId, setImportCalendarId] =
    useState<string>('__uncategorized__')

  const handleExport = async () => {
    try {
      setIsLoading(true)

      let filteredEvents = [...events]

      if (dateRangeOption === 'future') {
        const now = new Date()
        filteredEvents = filteredEvents.filter(
          (event) => new Date(event.startDate) >= now,
        )
      } else if (dateRangeOption === 'past') {
        const now = new Date()
        filteredEvents = filteredEvents.filter(
          (event) => new Date(event.startDate) < now,
        )
      } else if (dateRangeOption === '30days') {
        const now = new Date()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        filteredEvents = filteredEvents.filter(
          (event) =>
            new Date(event.startDate) >= thirtyDaysAgo &&
            new Date(event.startDate) <= now,
        )
      } else if (dateRangeOption === '90days') {
        const now = new Date()
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        filteredEvents = filteredEvents.filter(
          (event) =>
            new Date(event.startDate) >= ninetyDaysAgo &&
            new Date(event.startDate) <= now,
        )
      }

      if (exportFormat === 'ics') {
        const icsContent = generateICSFile(filteredEvents)
        if (
          (await downloadFile(
            icsContent,
            'calendar-export.ics',
            'text/calendar',
          )) === false
        )
          return
      } else if (exportFormat === 'json') {
        const backupEvents = toBackupEvents(filteredEvents)
        const exportPayload: JsonBackupPayloadV2 = {
          format: 'one-calendar-json-v2',
          exportedAt: new Date().toISOString(),
          data: {
            events: backupEvents,
            calendars: categories.map((c: CategoryData) => ({
              id: c.id,
              name: c.name,
              color: c.color,
            })),
            // Keyed off the collapsed rows so the map has no entries for
            // occurrences that are no longer exported.
            eventCategoryMap: Object.fromEntries(
              backupEvents.map((event) => [event.id, event.calendarId || '']),
            ),
            bookmarks: bookmarks.map((b: BookmarkData) => ({
              eventId: b.eventId,
            })),
            countdowns: countdowns.map((c: CountdownData) => ({
              id: c.id,
              name: c.name,
              targetDate: c.targetDate,
              repeat: c.repeat,
              description: c.description,
              color: c.color,
              icon: c.icon,
            })),
            settings: {
              language: settings.language,
              firstDayOfWeek: settings.firstDayOfWeek,
              timezone: settings.timezone,
              defaultView: settings.defaultView,
              enableShortcuts: settings.enableShortcuts,
              timeFormat: settings.timeFormat,
              theme: settings.theme,
              calendarColor: settings.calendarColor,
            },
          },
        }

        const jsonContent = JSON.stringify(exportPayload, null, 2)
        if (
          (await downloadFile(
            jsonContent,
            'calendar-export.json',
            'application/json',
          )) === false
        )
          return
      } else if (exportFormat === 'csv') {
        const csvContent = generateCSV(filteredEvents)
        if (
          (await downloadFile(
            csvContent,
            'calendar-export.csv',
            'text/csv',
          )) === false
        )
          return
      }

      toast(
        t.exportSuccess.replace('{count}', filteredEvents.length.toString()),
        {
          description: `${filteredEvents.length} ${t.events}`,
        },
      )

      setExportDialogOpen(false)
    } catch (error) {
      toast.error(t.exportError, {
        description: t.exportError,
      })
      console.error('Export error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const mapCalendarColorToEventColor = (calendarColor?: string) => {
    const mapping: Record<string, string> = {
      'bg-blue-500': 'bg-[#E6F6FD]',
      'bg-green-500': 'bg-[#E7F8F2]',
      'bg-yellow-500': 'bg-[#FEF5E6]',
      'bg-red-500': 'bg-[#FFE4E6]',
      'bg-purple-500': 'bg-[#F3EEFE]',
      'bg-pink-500': 'bg-[#FCE7F3]',
      'bg-teal-500': 'bg-[#E6FAF7]',
    }
    return mapping[calendarColor || ''] || 'bg-[#E6F6FD]'
  }

  const applyImportCategory = (eventsToImport: CalendarEvent[]) => {
    const targetCategory = categories.find(
      (calendar: CategoryData) => calendar.id === importCalendarId,
    )
    const categoryId =
      importCalendarId === '__uncategorized__' ? '' : importCalendarId
    const color = mapCalendarColorToEventColor(targetCategory?.color)

    return eventsToImport.map((event) => ({
      ...event,
      calendarId: categoryId,
      color,
    }))
  }

  const handleImport = async () => {
    try {
      setIsLoading(true)
      setDebugInfo('')
      let importedEvents: CalendarEvent[] = []
      let shouldApplyCategory = true
      let rawContent = ''
      let extraCategories: ImportedCategory[] = []
      let extraCountdowns: CountdownData[] = []
      let extraBookmarks: BookmarkData[] = []
      let extraSettings: SettingsData = {}

      if (importTab === 'file' && selectedFile) {
        const fileExt = selectedFile.name.split('.').pop()?.toLowerCase()
        rawContent = await selectedFile.text()

        if (fileExt === 'ics') {
          // Normalise rather than cast: parseICS returns its own shape (and
          // recurrence overrides carry seriesId/recurrenceId), so the store
          // needs real Dates and defaulted fields.
          importedEvents = parseICS(rawContent, {
            fallbackTitle: t.unnamedEvent,
          }).map((event) => normalizeImportedEvent(event))
        } else if (fileExt === 'json') {
          const parsedResult = await parseJsonEvents(rawContent)
          importedEvents = parsedResult.events
          shouldApplyCategory = parsedResult.shouldApplyImportCategory
          extraCategories = parsedResult.categories
          extraCountdowns = parsedResult.countdowns
          extraBookmarks = parsedResult.bookmarks
          extraSettings = parsedResult.settings
        } else if (fileExt === 'csv') {
          importedEvents = parseCSV(rawContent)
        } else {
          throw new Error(t.unsupportedFormat)
        }
      } else if (importTab === 'url' && importUrl) {
        const response = readExternal
          ? new Response(await readExternal(importUrl))
          : await fetch(importUrl)
        rawContent = await response.text()

        if (importUrl.endsWith('.ics')) {
          // Normalise rather than cast: parseICS returns its own shape (and
          // recurrence overrides carry seriesId/recurrenceId), so the store
          // needs real Dates and defaulted fields.
          importedEvents = parseICS(rawContent, {
            fallbackTitle: t.unnamedEvent,
          }).map((event) => normalizeImportedEvent(event))
        } else if (importUrl.endsWith('.json')) {
          const parsedResult = await parseJsonEvents(rawContent)
          importedEvents = parsedResult.events
          shouldApplyCategory = parsedResult.shouldApplyImportCategory
          extraCategories = parsedResult.categories
          extraCountdowns = parsedResult.countdowns
          extraBookmarks = parsedResult.bookmarks
          extraSettings = parsedResult.settings
        } else {
          throw new Error(t.unsupportedUrlFormat)
        }
      }

      if (debugMode) {
        setDebugInfo(`${t.parsedEvents} ${importedEvents.length} ${t.events}

${t.rawContentPreview}:
${rawContent.substring(0, 500)}...`)
      }

      if (importedEvents.length === 0) {
        toast.error(t.importWarning, {
          description: t.importWarning,
        })
        return
      }

      const normalizedImportedEvents = shouldApplyCategory
        ? applyImportCategory(importedEvents)
        : importedEvents

      const res = await request('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: normalizedImportedEvents.map((event) => ({
            id: event.id,
            title: event.title,
            startDate: event.startDate.toISOString(),
            endDate: event.endDate.toISOString(),
            isAllDay: event.isAllDay,
            // `normalizeImportedEvent` computes the recurrence fields but the
            // mapping below used to stop at `location`, so a restore flattened
            // every series into one non-recurring event and dropped every
            // single-instance edit. Send what was parsed.
            description: event.description ?? null,
            location: event.location || null,
            rrule: event.rrule ?? null,
            exdate: event.exdate ?? null,
            seriesId: event.seriesId ?? null,
            recurrenceId: event.recurrenceId ?? null,
            participants: event.participants?.length
              ? event.participants.map((p: any) =>
                  typeof p === 'string' ? { name: p } : p,
                )
              : null,
            notificationMinutes: event.notification || null,
            color: event.color || null,
            categoryId: event.calendarId || null,
          })),
          categories: extraCategories.length > 0 ? extraCategories : undefined,
          countdowns: extraCountdowns.length > 0 ? extraCountdowns : undefined,
          bookmarks: extraBookmarks.length > 0 ? extraBookmarks : undefined,
          settings:
            Object.keys(extraSettings).length > 0 ? extraSettings : undefined,
        }),
      })

      if (!res.ok) {
        throw new Error(`Import failed: ${res.status}`)
      }

      void refresh()

      // The server's count, not ours.
      //
      // The toast used to report `importedEvents.length` — the number of
      // events we parsed locally — while the route silently skips any event
      // whose id already belongs to another account (`skippedEvents`). So a
      // file that parsed cleanly could report "imported 40 events" having
      // written none of them, which reads as a broken app rather than as a
      // refusal. It also hid the settings-only case, where the body carried
      // events but none survived to be inserted.
      const result = (await res.json().catch(() => null)) as {
        imported?: { events?: number }
        skippedEvents?: number
      } | null
      const inserted =
        result?.imported?.events ?? normalizedImportedEvents.length
      const skipped = result?.skippedEvents ?? 0

      if (inserted === 0) {
        toast.error(t.importWarning, {
          description:
            skipped > 0
              ? `${skipped} ${t.events}`
              : `${normalizedImportedEvents.length} ${t.events}`,
        })
      } else {
        toast(
          t.importSuccess.replace('{count}', String(inserted)),
          skipped > 0 ? { description: `${skipped} ${t.events}` } : undefined,
        )
      }

      if (!debugMode) {
        setImportDialogOpen(false)
      }
      if (debugMode && importedEvents.length > 0) {
        const firstEvent = importedEvents[0]
        setDebugInfo(`${t.parsedEvents} ${importedEvents.length} ${t.events}

First event details:
Title: ${firstEvent.title}
Start: ${new Date(firstEvent.startDate).toLocaleString()} (Local)
End: ${new Date(firstEvent.endDate).toLocaleString()} (Local)
UTC Start: ${new Date(firstEvent.startDate).toUTCString()}
UTC End: ${new Date(firstEvent.endDate).toUTCString()}

${t.rawContentPreview}:
${rawContent.substring(0, 500)}...`)
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : t.unknownError
      toast.error(t.importError.replace('{error}', errorMessage), {
        description: errorMessage,
      })
      console.error('Import error:', error)

      if (debugMode) {
        setDebugInfo(`${t.importError}: ${errorMessage}`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const parseJsonEvents = async (
    rawContent: string,
  ): Promise<{
    events: CalendarEvent[]
    shouldApplyImportCategory: boolean
    categories: ImportedCategory[]
    countdowns: CountdownData[]
    bookmarks: BookmarkData[]
    settings: SettingsData
  }> => {
    const parsed = JSON.parse(rawContent)

    if (Array.isArray(parsed)) {
      return {
        events: parsed.map((event) => normalizeImportedEvent(event)),
        shouldApplyImportCategory: true,
        categories: [],
        countdowns: [],
        bookmarks: [],
        settings: {},
      }
    }

    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.format === 'one-calendar-json-v2' &&
      parsed.data
    ) {
      const payload = parsed as JsonBackupPayloadV2
      const importedEvents = Array.isArray(payload.data.events)
        ? payload.data.events.map((event) => normalizeImportedEvent(event))
        : []
      const importedCategories = Array.isArray(payload.data.calendars)
        ? payload.data.calendars
        : []
      const relationMap = payload.data.eventCategoryMap || {}
      const categoryIdSet = new Set(importedCategories.map((item) => item.id))

      const extraCategoryIds = new Set<string>()
      importedEvents.forEach((event) => {
        const mappedCategoryId = relationMap[event.id]
        if (typeof mappedCategoryId === 'string') {
          event.calendarId = mappedCategoryId
        }
        if (event.calendarId && !categoryIdSet.has(event.calendarId)) {
          extraCategoryIds.add(event.calendarId)
        }
      })

      const autoCategories: ImportedCategory[] = Array.from(
        extraCategoryIds,
      ).map((id) => ({
        id,
        name: `Imported ${id.slice(0, 6)}`,
        color: 'bg-blue-500',
        keywords: [],
      }))

      const allCategories = [...importedCategories, ...autoCategories]
      const existingIds = new Set(categories.map((c: CategoryData) => c.id))
      const newCategories = allCategories.filter(
        (cat) => !existingIds.has(cat.id),
      )

      const countdownsData = Array.isArray(payload.data.countdowns)
        ? (payload.data.countdowns as CountdownData[])
        : []

      const bookmarksData = Array.isArray(payload.data.bookmarks)
        ? (payload.data.bookmarks as BookmarkData[])
        : []

      const settingsData = (payload.data.settings || {}) as SettingsData

      return {
        events: importedEvents,
        shouldApplyImportCategory: false,
        categories: newCategories,
        countdowns: countdownsData,
        bookmarks: bookmarksData,
        settings: settingsData,
      }
    }

    throw new Error(t.unsupportedFormat)
  }

  /**
   * Accepts both a parsed ics/csv event and a JSON-backup event. Dates arrive as
   * `Date` from the parsers and as ISO strings from a JSON file, hence the loose
   * input type.
   *
   * Recurrence fields must survive: a backup now stores a series once (master +
   * rrule + exdate) plus its single-instance edits, so dropping `exdate` or the
   * `seriesId`/`recurrenceId` link would import the series without its
   * exclusions and turn every edited occurrence into a detached event.
   */
  const normalizeImportedEvent = (input: ImportableEvent): CalendarEvent => {
    const start = input.startDate ? new Date(input.startDate) : new Date()
    const parsedEnd = input.endDate
      ? new Date(input.endDate)
      : new Date(start.getTime() + 60 * 60 * 1000)
    const end =
      parsedEnd < start ? new Date(start.getTime() + 60 * 60 * 1000) : parsedEnd

    // A backup keeps only email + status per invite; the rest (tokens, delivery
    // flags, avatars) is server state that is re-created on invite.
    const invites = Array.isArray(input.invites)
      ? input.invites
          .filter((invite) => typeof invite?.email === 'string')
          .map((invite) => ({
            id: `${Date.now()}${Math.random().toString(36).slice(2, 9)}`,
            email: invite.email as string,
            status: (invite.status ?? 'pending') as
              'pending' | 'accepted' | 'maybe' | 'declined',
            inviteToken: '',
            emailSent: false,
            addedToCalendar: false,
            userName: null,
            userImage: null,
          }))
      : undefined

    return {
      id: input.id || `${Date.now()}${Math.random().toString(36).slice(2, 9)}`,
      title: input.title || t.unnamedEvent,
      startDate: start,
      endDate: end,
      isAllDay: Boolean(input.isAllDay),
      rrule: input.rrule ? input.rrule.replace(/^RRULE:/i, '') : null,
      exdate: Array.isArray(input.exdate) ? input.exdate : null,
      ...(input.isOverride
        ? {
            // RFC 5545 gives every occurrence of a series ONE UID and
            // distinguishes the edited one by RECURRENCE-ID, so `parseICS`
            // derives both the master and its overrides from the same `id`.
            // The series is therefore the id itself whenever the payload did
            // not spell the link out — a JSON backup carries `seriesId`
            // explicitly, an ICS file does not.
            seriesId: input.seriesId ?? input.id ?? null,
            recurrenceId: input.recurrenceId ?? null,
            isOverride: true,
          }
        : {}),
      location: input.location,
      participants: Array.isArray(input.participants) ? input.participants : [],
      // An absent reminder in a backup means no reminder, not "at the start".
      notification:
        typeof input.notification === 'number' ? input.notification : null,
      description: input.description,
      color: input.color || 'bg-[#E6F6FD]',
      calendarId: input.calendarId || '',
      ...(invites?.length ? { invites } : {}),
    }
  }

  const generateCSV = (events: CalendarEvent[]): string => {
    // All Day / Reminder / Repeat Rule were previously dropped, so a CSV
    // round-trip silently turned all-day events into timed ones and lost every
    // recurrence. Recurring series are collapsed the same way as the ics export
    // so one series is one row, not one row per occurrence.
    const headers = [
      'Title',
      'Start Date',
      'End Date',
      'All Day',
      'Location',
      'Description',
      'Reminder Minutes',
      'Repeat Rule',
      'Color',
    ]

    const rows = collapseSeriesForExport(
      events as unknown as Parameters<typeof collapseSeriesForExport>[0],
    ).map((event) => [
      event.title,
      new Date(event.startDate).toISOString(),
      new Date(event.endDate).toISOString(),
      event.isAllDay ? 'true' : 'false',
      event.location || '',
      event.description || '',
      event.notification !== null && event.notification !== undefined
        ? String(event.notification)
        : '',
      (event.rrule ?? '').replace(/^RRULE:/i, ''),
      event.color || '',
    ])

    // CRLF and a UTF-8 BOM: Excel misreads plain LF and mangles non-ASCII
    // titles without the BOM.
    return (
      '\uFEFF' +
      [
        headers.join(','),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
        ),
      ].join('\r\n')
    )
  }

  const parseCSV = (csvContent: string): CalendarEvent[] => {
    const lines = csvContent.split('\n')
    if (lines.length < 2) return []

    const headers = parseCSVLine(lines[0])

    const events: CalendarEvent[] = []

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue

      const values = parseCSVLine(lines[i])

      if (values.length >= 2) {
        const titleIndex = headers.findIndex((h) =>
          h.toLowerCase().includes('title'),
        )
        const startDateIndex = headers.findIndex((h) =>
          h.toLowerCase().includes('start'),
        )
        const endDateIndex = headers.findIndex((h) =>
          h.toLowerCase().includes('end'),
        )
        const locationIndex = headers.findIndex((h) =>
          h.toLowerCase().includes('location'),
        )
        const descriptionIndex = headers.findIndex((h) =>
          h.toLowerCase().includes('description'),
        )
        const colorIndex = headers.findIndex((h) =>
          h.toLowerCase().includes('color'),
        )
        // Columns added alongside the richer export; files from other tools
        // simply lack them and fall back to the previous defaults.
        const allDayIndex = headers.findIndex((h) =>
          h.toLowerCase().includes('all day'),
        )
        const reminderIndex = headers.findIndex((h) =>
          h.toLowerCase().includes('reminder'),
        )
        const rruleIndex = headers.findIndex(
          (h) =>
            h.toLowerCase().includes('repeat') ||
            h.toLowerCase().includes('rrule'),
        )
        const cell = (index: number): string =>
          index >= 0 && index < values.length ? values[index].trim() : ''

        const title =
          titleIndex >= 0 && titleIndex < values.length
            ? values[titleIndex]
            : t.unnamedEvent
        const startDate =
          startDateIndex >= 0 && startDateIndex < values.length
            ? new Date(values[startDateIndex])
            : new Date()
        let endDate =
          endDateIndex >= 0 && endDateIndex < values.length
            ? new Date(values[endDateIndex])
            : new Date(startDate.getTime() + 60 * 60 * 1000)

        if (endDate < startDate) {
          endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
        }

        events.push({
          id:
            Date.now().toString() + Math.random().toString(36).substring(2, 9),
          title,
          startDate,
          endDate,
          isAllDay: cell(allDayIndex).toLowerCase() === 'true',
          rrule: cell(rruleIndex) ? cell(rruleIndex) : null,
          location:
            locationIndex >= 0 && locationIndex < values.length
              ? values[locationIndex]
              : undefined,
          participants: [],
          notification: Number.parseInt(cell(reminderIndex), 10) || 0,
          description:
            descriptionIndex >= 0 && descriptionIndex < values.length
              ? values[descriptionIndex]
              : undefined,
          color:
            colorIndex >= 0 && colorIndex < values.length
              ? values[colorIndex]
              : 'bg-[#E6F6FD]',
          calendarId: '',
        })
      }
    }

    return events
  }

  const parseCSVLine = (line: string): string[] => {
    const result = []
    let insideQuotes = false
    let currentValue = ''

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        if (i < line.length - 1 && line[i + 1] === '"') {
          currentValue += '"'
          i++
        } else {
          insideQuotes = !insideQuotes
        }
      } else if (char === ',' && !insideQuotes) {
        result.push(currentValue.trim())
        currentValue = ''
      } else {
        currentValue += char
      }
    }

    result.push(currentValue.trim())
    return result
  }

  const downloadFile = async (
    content: string,
    filename: string,
    mimeType: string,
  ) => {
    if (saveFile) return saveFile(filename, content, mimeType)
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    return true
  }

  const handleImportDialogOpenChange = (open: boolean) => {
    setImportDialogOpen(open)
    if (open) {
      setImportTab('file')
      setSelectedFile(null)
      setImportUrl('')
      setDebugInfo('')
    }
  }

  return (
    <div className="w-full min-w-0 space-y-4">
      <section className="overflow-hidden rounded-lg border">
        <header className="border-b bg-muted/20 p-4">
          <h2 className="text-base font-semibold">{t.importExport}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t.importExportDesc}
          </p>
        </header>
        <div className="grid min-[520px]:grid-cols-2">
          <button
            type="button"
            onClick={() => handleImportDialogOpenChange(true)}
            className="group flex min-w-0 flex-col items-start gap-5 border-b p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring min-[520px]:border-r min-[520px]:border-b-0"
          >
            <span className="flex size-9 items-center justify-center rounded-lg border bg-background">
              <Upload className="size-4" />
            </span>
            <span className="w-full min-w-0">
              <span className="flex items-center justify-between gap-3 text-sm font-medium">
                {t.importCalendar}
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {t.fileImport} · {t.urlImport}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setExportDialogOpen(true)}
            className="group flex min-w-0 flex-col items-start gap-5 p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span className="flex size-9 items-center justify-center rounded-lg border bg-background">
              <Download className="size-4" />
            </span>
            <span className="w-full min-w-0">
              <span className="flex items-center justify-between gap-3 text-sm font-medium">
                {t.exportCalendar}
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
              </span>
              <span className="mt-1 block font-mono text-xs text-muted-foreground">
                .ics · .json · .csv
              </span>
            </span>
          </button>
        </div>
      </section>

      <div className="divide-y rounded-lg border">
        <details className="group p-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium [&::-webkit-details-marker]:hidden">
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">{t.googleCalendarGuide}</span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {t.googleCalendarGuideText}
          </p>
        </details>
        <details className="group p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-medium [&::-webkit-details-marker]:hidden">
            {t.importExportTips}
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-relaxed text-muted-foreground">
            <li>{t.tip1}</li>
            <li>{t.tip2}</li>
            <li>{t.tip4}</li>
            <li>{t.tip5}</li>
          </ul>
        </details>
      </div>

      <Dialog
        open={importDialogOpen}
        onOpenChange={handleImportDialogOpenChange}
      >
        <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
          <DialogHeader className="border-b p-5 pr-12">
            <DialogTitle className="flex items-center gap-2">
              <Upload className="size-4" />
              {t.importCalendar}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t.supportedFormats}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 p-5">
            <Tabs
              defaultValue="file"
              value={importTab}
              onValueChange={setImportTab}
              className="flex-col gap-4"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger
                  value="file"
                  className="min-w-0"
                  disabled={isLoading}
                >
                  <FileUp className="size-3.5" />
                  <span className="truncate">{t.fileImport}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="url"
                  className="min-w-0"
                  disabled={isLoading}
                >
                  <Link2 className="size-3.5" />
                  <span className="truncate">{t.urlImport}</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="file">
                <Label
                  htmlFor="calendar-file"
                  className="relative flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 p-5 text-center focus-within:ring-2 focus-within:ring-ring"
                >
                  <span className="flex size-10 items-center justify-center rounded-lg border bg-background">
                    <FileUp className="size-5 text-muted-foreground" />
                  </span>
                  <span className="w-full min-w-0">
                    <span className="block break-all text-sm font-medium">
                      {selectedFile ? selectedFile.name : t.selectCalendarFile}
                    </span>
                    <span className="mt-1 block font-mono text-xs font-normal text-muted-foreground">
                      {selectedFile
                        ? `${new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(selectedFile.size / 1024)} KB`
                        : '.ics · .json · .csv'}
                    </span>
                  </span>
                  <input
                    id="calendar-file"
                    type="file"
                    accept=".ics,.json,.csv"
                    aria-label={t.selectCalendarFile}
                    disabled={isLoading}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                    onChange={(e) =>
                      setSelectedFile(e.target.files?.[0] || null)
                    }
                  />
                </Label>
              </TabsContent>
              <TabsContent value="url">
                <div className="space-y-2">
                  <Label htmlFor="calendar-url">{t.calendarUrl}</Label>
                  <Input
                    id="calendar-url"
                    type="url"
                    placeholder="https://example.com/calendar.ics"
                    value={importUrl}
                    disabled={isLoading}
                    onChange={(e) => setImportUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t.enterUrl}</p>
                </div>
              </TabsContent>
            </Tabs>
            <div className="space-y-2">
              <Label htmlFor="import-calendar-category">
                {t.importToCalendarCategory}
              </Label>
              <Select
                value={importCalendarId}
                onValueChange={setImportCalendarId}
                disabled={isLoading}
              >
                <SelectTrigger
                  id="import-calendar-category"
                  className="w-full min-w-0"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__uncategorized__">
                    {t.uncategorized}
                  </SelectItem>
                  {categories.map((calendar: CategoryData) => (
                    <SelectItem key={calendar.id} value={calendar.id}>
                      {calendar.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 border-t pt-4">
              <Checkbox
                id="debug-mode"
                checked={debugMode}
                onCheckedChange={(checked) => setDebugMode(checked === true)}
              />
              <Label
                htmlFor="debug-mode"
                className="text-xs font-normal text-muted-foreground"
              >
                {t.debugMode}
              </Label>
            </div>
            {debugInfo && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <h4 className="font-medium mb-1">{t.debugInfo}</h4>
                <pre className="text-xs overflow-auto max-h-40 whitespace-pre-wrap">
                  {debugInfo}
                </pre>
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t bg-muted/20 p-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportDialogOpen(false)}
            >
              {t.cancel}
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={
                isLoading ||
                (importTab === 'file' ? !selectedFile : !importUrl.trim())
              }
            >
              {isLoading ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              {isLoading ? t.importing : t.import}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
          <DialogHeader className="border-b p-5 pr-12">
            <DialogTitle className="flex items-center gap-2">
              <Download className="size-4" />
              {t.exportCalendar}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t.importExportDesc}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 p-5">
            <fieldset className="min-w-0 space-y-2">
              <legend className="mb-2 text-sm font-medium">
                {t.exportFormat}
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'ics', Icon: CalendarDays, label: 'iCalendar' },
                  { value: 'json', Icon: FileCode2, label: 'JSON' },
                  { value: 'csv', Icon: FileSpreadsheet, label: 'CSV' },
                ].map(({ value, Icon, label }) => (
                  <label
                    key={value}
                    className={`relative flex min-w-0 cursor-pointer flex-col items-start gap-3 rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${exportFormat === value ? 'border-foreground/40 bg-muted/50' : 'hover:bg-muted/30'}`}
                  >
                    <input
                      type="radio"
                      name="export-format"
                      value={value}
                      checked={exportFormat === value}
                      onChange={() => setExportFormat(value)}
                      disabled={isLoading}
                      className="sr-only"
                    />
                    <Icon className="size-5 text-muted-foreground" />
                    <span className="max-w-full truncate text-xs font-medium">
                      {label}
                    </span>
                    {exportFormat === value && (
                      <Check className="absolute top-2 right-2 size-3" />
                    )}
                  </label>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {exportFormat === 'json'
                  ? [
                      t.events,
                      t.myCalendars,
                      t.bookmarks,
                      t.countdownTitle,
                      t.settings,
                    ].join(' · ')
                  : exportFormat === 'ics'
                    ? t.tip1
                    : t.tip2}
              </p>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="date-range">{t.dateRange}</Label>
              <Select
                value={dateRangeOption}
                onValueChange={setDateRangeOption}
              >
                <SelectTrigger id="date-range" className="w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.allEvents}</SelectItem>
                  <SelectItem value="future">{t.futureEvents}</SelectItem>
                  <SelectItem value="past">{t.pastEvents}</SelectItem>
                  <SelectItem value="30days">{t.last30Days}</SelectItem>
                  <SelectItem value="90days">{t.last90Days}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="include-completed"
                checked={includeCompleted}
                onCheckedChange={(checked) =>
                  setIncludeCompleted(checked as boolean)
                }
              />
              <Label
                htmlFor="include-completed"
                className="text-xs font-normal"
              >
                {t.includeCompleted}
              </Label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/20 p-4">
            <span className="mr-auto font-mono text-[11px] text-muted-foreground">
              calendar-export.{exportFormat}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportDialogOpen(false)}
            >
              {t.cancel}
            </Button>
            <Button size="sm" onClick={handleExport} disabled={isLoading}>
              {isLoading ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              {isLoading ? t.exporting : t.export}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
