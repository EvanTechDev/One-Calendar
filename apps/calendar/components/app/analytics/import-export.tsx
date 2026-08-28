'use client'

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
  DialogTitle,
} from '@zntr/ui/dialog'
import { Download, Upload, AlertCircle } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@zntr/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@zntr/ui/alert'
import { translations, useLanguage } from '@zntr/i18n/calendar'
import { collapseSeriesForExport, generateICSFile, parseICS } from '@/lib/ics'
import { Checkbox } from '@zntr/ui/checkbox'
import type { CalendarEvent } from '../calendar'
import { Button } from '@zntr/ui/button'
import { Input } from '@zntr/ui/input'
import { Label } from '@zntr/ui/label'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  useData,
  useCategories,
  useBookmarks,
  useCountdowns,
  useSettings,
} from '@/components/providers/data-provider'
import type {
  CategoryData,
  BookmarkData,
  CountdownData,
  SettingsData,
} from '@/lib/api-client'

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
        downloadFile(icsContent, 'calendar-export.ics', 'text/calendar')
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
            },
          },
        }

        const jsonContent = JSON.stringify(exportPayload, null, 2)
        downloadFile(jsonContent, 'calendar-export.json', 'application/json')
      } else if (exportFormat === 'csv') {
        const csvContent = generateCSV(filteredEvents)
        downloadFile(csvContent, 'calendar-export.csv', 'text/csv')
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
        const response = await fetch(importUrl)
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

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: normalizedImportedEvents.map((event) => ({
            id: event.id,
            title: event.title,
            startDate: event.startDate.toISOString(),
            endDate: event.endDate.toISOString(),
            isAllDay: event.isAllDay,
            location: event.location || null,
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

      toast(
        t.importSuccess.replace('{count}', importedEvents.length.toString()),
        {
          description: `${importedEvents.length} ${t.events}`,
        },
      )

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
              | 'pending'
              | 'accepted'
              | 'maybe'
              | 'declined',
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
            seriesId: input.seriesId ?? null,
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

  const downloadFile = (
    content: string,
    filename: string,
    mimeType: string,
  ) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
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
    <div className="w-full rounded-lg border p-4 space-y-6">
      <div>
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-base font-semibold">{t.importExport}</h2>
            <p className="text-sm text-muted-foreground">
              {t.importExportDesc}
            </p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              {t.importCalendar}
            </Button>
            <Button onClick={() => setExportDialogOpen(true)}>
              <Download className="mr-2 h-4 w-4" />
              {t.exportCalendar}
            </Button>
          </div>
        </div>
      </div>

      <div>
        <div className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t.googleCalendarGuide}</AlertTitle>
            <AlertDescription>{t.googleCalendarGuideText}</AlertDescription>
          </Alert>
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-2">{t.importExportTips}</h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>{t.tip1}</li>
              <li>{t.tip2}</li>
              <li>{t.tip3}</li>
              <li>{t.tip4}</li>
              <li>{t.tip5}</li>
            </ul>
          </div>
        </div>
      </div>

      <Dialog
        open={importDialogOpen}
        onOpenChange={handleImportDialogOpenChange}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.importCalendar}</DialogTitle>
          </DialogHeader>

          <Tabs
            defaultValue="file"
            value={importTab}
            onValueChange={setImportTab}
            className="flex-col"
          >
            {/*
              `w-full` plus a truncating span per trigger. TabsTrigger carries
              `whitespace-nowrap` and a fixed `h-8`, so in a bare `grid-cols-2`
              a label like lt "Failo importavimas" or mk "Увоз од датотека"
              ran straight out of this `max-w-md` dialog. The span is what
              actually clips — the trigger is an inline-flex box, so `truncate`
              on it alone does nothing to the text inside.
            */}
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="file" className="min-w-0">
                <span className="truncate">{t.fileImport}</span>
              </TabsTrigger>
              <TabsTrigger value="url" className="min-w-0">
                <span className="truncate">{t.urlImport}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="calendar-file">{t.selectCalendarFile}</Label>
                <Input
                  id="calendar-file"
                  type="file"
                  accept=".ics,.json,.csv"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted-foreground">
                  {t.supportedFormats}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="import-calendar-category">
                  {t.importToCalendarCategory}
                </Label>
                <Select
                  value={importCalendarId}
                  onValueChange={setImportCalendarId}
                >
                  <SelectTrigger id="import-calendar-category">
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

              <Alert variant="default">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{t.googleCalendarGuideText}</AlertDescription>
              </Alert>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="debug-mode"
                  checked={debugMode}
                  onCheckedChange={(checked) =>
                    setDebugMode(checked as boolean)
                  }
                />
                <Label htmlFor="debug-mode">{t.debugMode}</Label>
              </div>
            </TabsContent>

            <TabsContent value="url" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="calendar-url">{t.calendarUrl}</Label>
                <Input
                  id="calendar-url"
                  type="url"
                  placeholder="https://example.com/calendar.ics"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t.enterUrl}</p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="debug-mode-url"
                  checked={debugMode}
                  onCheckedChange={(checked) =>
                    setDebugMode(checked as boolean)
                  }
                />
                <Label htmlFor="debug-mode-url">{t.debugMode}</Label>
              </div>
            </TabsContent>
          </Tabs>

          {debugInfo && (
            <div className="mt-4 rounded-md bg-muted p-2">
              <h4 className="font-medium mb-1">{t.debugInfo}</h4>
              <pre className="text-xs overflow-auto max-h-40 whitespace-pre-wrap">
                {debugInfo}
              </pre>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setImportDialogOpen(false)}
            >
              {t.cancel}
            </Button>
            <Button onClick={handleImport} disabled={isLoading}>
              {isLoading ? t.importing : t.import}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.exportCalendar}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="export-format">{t.exportFormat}</Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger id="export-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ics">iCalendar (.ics)</SelectItem>
                  <SelectItem value="json">JSON (.json)</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-range">{t.dateRange}</Label>
              <Select
                value={dateRangeOption}
                onValueChange={setDateRangeOption}
              >
                <SelectTrigger id="date-range">
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

            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-completed"
                checked={includeCompleted}
                onCheckedChange={(checked) =>
                  setIncludeCompleted(checked as boolean)
                }
              />
              <Label htmlFor="include-completed">{t.includeCompleted}</Label>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setExportDialogOpen(false)}
            >
              {t.cancel}
            </Button>
            <Button onClick={handleExport} disabled={isLoading}>
              {isLoading ? t.exporting : t.export}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
