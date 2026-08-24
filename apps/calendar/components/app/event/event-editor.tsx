'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@zntr/ui/select'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@zntr/ui/popover'
import { createPortal } from 'react-dom'
import { RemoveScroll } from 'react-remove-scroll'
import {
  useLiveAnchorRect,
  pickPopoverSide,
  buildAnchorStyle,
} from '@/hooks/use-anchored-popover'
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
import { addDays, format, getHours, getMinutes, set } from 'date-fns'
import { Calendar as CalendarIcon, Clock, X } from 'lucide-react'
import { isZhLanguage, translations } from '@zntr/i18n/calendar'
import { useCalendar } from '@/components/providers/calendar-context'
import { requestNotificationPermission } from '@/lib/notifications'
import { Checkbox } from '@zntr/ui/checkbox'
import { Textarea } from '@zntr/ui/textarea'
import { Calendar } from '@zntr/ui/calendar'
import { Button } from '@zntr/ui/button'
import { Input } from '@zntr/ui/input'
import { Label } from '@zntr/ui/label'
import { useState, useEffect } from 'react'
import { cn } from '@zntr/utils'
import { uuid } from '@/lib/uuid'
import type { CalendarEvent } from '@/components/app/calendar'
import {
  EVENT_COLOR_OPTIONS,
  CALENDAR_COLOR_TO_EVENT_COLOR,
  EVENT_BG_TO_ACCENT,
} from '@/lib/event-colors'
import {
  describeRecurrence,
  emptyRruleParts,
  parseWeekdayToken,
  rruleFromParts,
  rruleToParts,
  toRfcStamp,
  parseRfcStamp,
  type RruleParts,
} from '@/lib/recurrence'
import type { ViewConfig } from '@/lib/calendar-types'
import { EventMeetingField } from '@/components/app/event/event-meeting-field'

const hourOptions = Array.from({ length: 24 }, (_, i) => ({
  value: i.toString().padStart(2, '0'),
  label: i.toString().padStart(2, '0'),
}))

const minuteOptions = Array.from({ length: 12 }, (_, i) => ({
  value: (i * 5).toString().padStart(2, '0'),
  label: (i * 5).toString().padStart(2, '0'),
}))

/**
 * Sentinel for the reminder select's "no reminder" option. A Select needs a
 * non-empty string value, so null cannot be used directly.
 */
const NO_REMINDER = 'none'

/** Reminder values the select offers directly; anything else is "custom". */
const PRESET_REMINDER_MINUTES = [0, 5, 15, 30, 60]

interface EventEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEventAdd: (event: CalendarEvent) => void
  onEventUpdate: (
    event: CalendarEvent,
    applyTo?: 'single' | 'following' | 'all',
  ) => void
  onEventDelete: (
    eventId: string,
    applyTo?: 'single' | 'following' | 'all',
  ) => void
  onInvitesAdded: (
    eventId: string,
    emails: string[],
    /** Which occurrences the new participants apply to. */
    scope?: 'single' | 'following' | 'all',
  ) => void
  initialDate: Date
  initialEndDate?: Date | null
  /**
   * Live draft range while creating. Fired whenever the editor's start/end
   * date-time fields change, so the views can keep the selection box
   * (CORE-191) in sync with what the user is typing. Not fired when editing
   * an existing event.
   */
  onDraftRangeChange?: (range: { start: Date; end: Date } | null) => void
  /**
   * True when the editor is replacing the preview popover at the same
   * anchor. The preview unmounts instantly (no exit animation), so playing
   * the editor's zoom-in entrance reads as a flash; appearing in place makes
   * the hand-off look like one panel swapping content.
   */
  replacesPreview?: boolean
  event: CalendarEvent | null
  config: ViewConfig
  /**
   * Where the editor points. For an existing event this is the event block;
   * for drag-to-create it is the blue selection box, which the views keep on
   * screen while the editor is open exactly so it can be anchored to
   * (CORE-191). Resolution mirrors the event preview.
   */
  anchorRect?: DOMRect | null
  anchorElement?: HTMLElement | null
  scrollContainerRef?: React.RefObject<HTMLElement | null>
}

interface TimeInput {
  hours: string
  minutes: string
  rawInput: string
  isCustomInput: boolean
}

export default function EventEditor({
  open,
  onOpenChange,
  onEventAdd,
  onEventUpdate,
  onEventDelete,
  onInvitesAdded,
  initialDate,
  initialEndDate,
  onDraftRangeChange,
  replacesPreview = false,
  event,
  config,
  anchorRect = null,
  anchorElement,
  scrollContainerRef,
}: EventEditorProps) {
  if (!config) return null
  const { calendars, events } = useCalendar()

  // Anchor resolution shared with the event preview, so editing and
  // previewing position identically (CORE-191). Editing an existing event
  // re-anchors to its block; creating anchors to the selection box the views
  // keep rendered while this editor is open.
  const effectiveAnchorRect = useLiveAnchorRect({
    open,
    anchorElement,
    anchorSelector: event
      ? `[data-event-id="${CSS.escape(event.id)}"]`
      : '[data-create-selection]',
    anchorRect,
    scrollContainerRef,
    // Creating anchors to an element the user did not click (the
    // highlighted day/range), which may be scrolled out of view — in the
    // month/year grids especially. Editing anchors to the block the user
    // just clicked, which is visible by definition.
    scrollIntoViewOnOpen: !event,
  })
  const popoverSide = pickPopoverSide(effectiveAnchorRect, 460, 620)
  const anchorStyle = buildAnchorStyle(
    effectiveAnchorRect,
    popoverSide,
    scrollContainerRef?.current,
  )

  const [participants, setParticipants] = useState('')
  const [customNotificationTime, setCustomNotificationTime] = useState('10')
  const [selectedCalendar, setSelectedCalendar] = useState('')
  const [notification, setNotification] = useState(NO_REMINDER)
  const [emailReminder, setEmailReminder] = useState(false)
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  /**
   * A Series carries its Meeting on the master row (ADR-0019), so editing an
   * occurrence still targets the series. Null while the event is a draft.
   */
  const meetingEventId = event ? (event.seriesId ?? event.id) : null
  /** "Add Zentra Meet" pressed on a draft — attach it once the event exists. */
  const [meetingPending, setMeetingPending] = useState(false)
  const [title, setTitle] = useState('')
  const [color, setColor] = useState(EVENT_COLOR_OPTIONS[0].value)

  const [isAllDay, setIsAllDay] = useState(false)
  const [endTimeError, setEndTimeError] = useState(false)
  const [startTimeError, setStartTimeError] = useState(false)
  const [participantError, setParticipantError] = useState('')
  const [endDateOpen, setEndDateOpen] = useState(false)
  const [startDateOpen, setStartDateOpen] = useState(false)
  const [endTimeOpen, setEndTimeOpen] = useState(false)
  const [startTimeOpen, setStartTimeOpen] = useState(false)

  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false)
  const [applyTo, setApplyTo] = useState<'single' | 'following' | 'all'>('all')
  const [saveScopeOpen, setSaveScopeOpen] = useState(false)
  const [saveScope, setSaveScope] = useState<'single' | 'following' | 'all'>(
    'single',
  )
  /**
   * Which occurrences newly added participants apply to. Chosen independently
   * of the event's own scope — moving just this occurrence while inviting
   * someone to the whole series is legitimate. See
   * ADR-0007 (participant scope follows the same rules as event scope).
   */
  const [participantScope, setParticipantScope] = useState<
    'single' | 'following' | 'all'
  >('single')
  const [pendingScopeSubmit, setPendingScopeSubmit] = useState<{
    eventData: CalendarEvent
    emails: string[]
    /** Participants not already invited, so the radio group only shows when relevant. */
    newEmails: string[]
  } | null>(null)
  // "All events" is only offered on the series' first occurrence. A raw
  // master row (imported/duplicated events pushed into the store directly)
  // IS the series root, so "all" stays allowed there; an expanded instance
  // needs the isFirstInstance marker from the server/engine expansion.
  const isRawMasterTarget =
    !!event?.rrule && !event?.seriesId && !event?.recurrenceId
  const canAllScope =
    !!event && (isRawMasterTarget || event.isFirstInstance === true)
  const [recFreq, setRecFreq] = useState<
    'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  >('WEEKLY')
  const [recInterval, setRecInterval] = useState(1)
  const [recEndMode, setRecEndMode] = useState<'never' | 'count' | 'until'>(
    'never',
  )
  const [recCount, setRecCount] = useState(10)
  const [recUntil, setRecUntil] = useState<Date>(() => addDays(new Date(), 365))
  const [recWeeklyDays, setRecWeeklyDays] = useState<string[]>([])
  const [recMonthlyMode, setRecMonthlyMode] = useState<'day' | 'weekday'>('day')
  const [recMonthlyDay, setRecMonthlyDay] = useState(1)
  const [recMonthlyWeek, setRecMonthlyWeek] = useState(1)
  const [recMonthlyWeekday, setRecMonthlyWeekday] = useState('MO')
  const [recYearlyMonth, setRecYearlyMonth] = useState(1)
  const [recYearlyDay, setRecYearlyDay] = useState(1)

  const [startDate, setStartDate] = useState(initialDate)
  const [endDate, setEndDate] = useState(initialDate)
  const [startTime, setStartTime] = useState<TimeInput>({
    hours: '00',
    minutes: '00',
    rawInput: '',
    isCustomInput: false,
  })
  const [endTime, setEndTime] = useState<TimeInput>({
    hours: '00',
    minutes: '30',
    rawInput: '',
    isCustomInput: false,
  })

  const calendarSelectValue =
    selectedCalendar || (calendars.length > 0 ? '__uncategorized__' : '')
  const isZh = isZhLanguage(config.language.code as any)
  const t = translations[config.language.code as keyof typeof translations]

  const getEventColorByCalendarId = (calendarId: string) => {
    const calendar = calendars.find((item) => item.id === calendarId)
    if (!calendar) return EVENT_COLOR_OPTIONS[0].value
    return (
      CALENDAR_COLOR_TO_EVENT_COLOR[calendar.color] ??
      EVENT_COLOR_OPTIONS[0].value
    )
  }

  const combineDateTime = (date: Date, timeInput: TimeInput): Date => {
    if (timeInput.isCustomInput && timeInput.rawInput) {
      const timeParts = timeInput.rawInput.split(':')
      if (timeParts.length === 2) {
        const hours = parseInt(timeParts[0], 10)
        const minutes = parseInt(timeParts[1], 10)

        if (
          !isNaN(hours) &&
          !isNaN(minutes) &&
          hours >= 0 &&
          hours < 24 &&
          minutes >= 0 &&
          minutes < 60
        ) {
          return set(new Date(date), {
            hours,
            minutes,
            seconds: 0,
            milliseconds: 0,
          })
        }
      }

      return set(new Date(date), {
        hours: parseInt(timeInput.hours, 10),
        minutes: parseInt(timeInput.minutes, 10),
        seconds: 0,
        milliseconds: 0,
      })
    }

    return set(new Date(date), {
      hours: parseInt(timeInput.hours, 10),
      minutes: parseInt(timeInput.minutes, 10),
      seconds: 0,
      milliseconds: 0,
    })
  }

  const getFullStartDate = () => combineDateTime(startDate, startTime)
  const getFullEndDate = () => combineDateTime(endDate, endTime)

  // Keep the views' selection box in sync with the editor's draft range
  // while creating (CORE-191). All-day drafts span whole days; timed drafts
  // use the combined date+time fields. Invalid or inverted input is passed
  // through — the views clamp per day and simply skip days they don't show.
  useEffect(() => {
    if (!onDraftRangeChange) return
    if (!open || event) {
      onDraftRangeChange(null)
      return
    }

    let start = combineDateTime(startDate, startTime)
    let end = combineDateTime(endDate, endTime)
    if (isAllDay) {
      start = set(new Date(startDate), {
        hours: 0,
        minutes: 0,
        seconds: 0,
        milliseconds: 0,
      })
      end = set(new Date(endDate), {
        hours: 23,
        minutes: 59,
        seconds: 0,
        milliseconds: 0,
      })
    }
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return

    onDraftRangeChange({ start, end })
    // combineDateTime is stable in behavior; deps below cover its inputs.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event, startDate, endDate, startTime, endTime, isAllDay])

  const validateTimeFormat = (input: string): boolean => {
    if (!input) return false

    const timeParts = input.split(':')
    if (timeParts.length !== 2) return false

    const hours = parseInt(timeParts[0], 10)
    const minutes = parseInt(timeParts[1], 10)

    return (
      !isNaN(hours) &&
      !isNaN(minutes) &&
      hours >= 0 &&
      hours < 24 &&
      minutes >= 0 &&
      minutes < 60
    )
  }

  const handleStartTimeInput = (input: string) => {
    setStartTime((prev) => ({
      ...prev,
      rawInput: input,
      isCustomInput: true,
    }))

    if (input === '' || validateTimeFormat(input)) {
      setStartTimeError(false)
    } else {
      setStartTimeError(true)
    }
  }

  const handleEndTimeInput = (input: string) => {
    setEndTime((prev) => ({
      ...prev,
      rawInput: input,
      isCustomInput: true,
    }))

    if (input === '' || validateTimeFormat(input)) {
      setEndTimeError(false)
    } else {
      setEndTimeError(true)
    }
  }

  const extractTimeFromDate = (date: Date): TimeInput => {
    return {
      hours: getHours(date).toString().padStart(2, '0'),
      minutes: getMinutes(date).toString().padStart(2, '0'),
      rawInput: format(date, 'HH:mm'),
      isCustomInput: false,
    }
  }

  useEffect(() => {
    if (open) {
      if (event) {
        setTitle(event.title)
        setIsAllDay(event.isAllDay)

        const startDateObj = new Date(event.startDate)
        const endDateObj = new Date(event.endDate)

        setStartDate(startDateObj)
        setEndDate(endDateObj)
        setStartTime(extractTimeFromDate(startDateObj))
        setEndTime(extractTimeFromDate(endDateObj))

        setLocation(event.location || '')

        const existingParticipantEmails: string[] = []
        const seenEmails = new Set<string>()
        const addParticipantEmail = (email: string) => {
          const trimmed = email.trim()
          const key = trimmed.toLowerCase()
          if (trimmed && !seenEmails.has(key)) {
            seenEmails.add(key)
            existingParticipantEmails.push(trimmed)
          }
        }
        ;(event.participants ?? []).forEach(addParticipantEmail)
        ;(event.invites ?? []).forEach((invite) =>
          addParticipantEmail(invite.email),
        )
        setParticipants(existingParticipantEmails.join(', '))
        if (event.notification === null || event.notification === undefined) {
          setNotification(NO_REMINDER)
        } else if (PRESET_REMINDER_MINUTES.includes(event.notification)) {
          setNotification(event.notification.toString())
        } else {
          setNotification('custom')
          setCustomNotificationTime(event.notification.toString())
        }
        setEmailReminder(event.emailReminder === true)
        setDescription(event.description || '')
        setColor(event.color)
        setSelectedCalendar(event.calendarId || '')

        const recurring =
          !!event.rrule || !!event.seriesId || !!event.recurrenceId
        const seriesRule =
          event.rrule ??
          (event.seriesId
            ? (events.find((e) => e.id === event.seriesId)?.rrule ?? null)
            : null)
        setRecurrenceEnabled(!!seriesRule)
        setApplyTo(
          recurring
            ? event.seriesId || event.recurrenceId
              ? 'single'
              : 'all'
            : 'all',
        )
        if (seriesRule) {
          const parts = rruleToParts(seriesRule)
          setRecFreq(parts.freq)
          setRecInterval(parts.interval || 1)
          // The editor works on bare day names; ordinal prefixes ("2MO") are
          // carried by the monthly-weekday controls instead.
          setRecWeeklyDays(
            (parts.byweekday ?? [])
              .map((token) => parseWeekdayToken(token)?.day)
              .filter((day): day is string => day !== undefined),
          )
          const firstWeekdayToken = parts.byweekday?.[0]
          const firstWeekday = firstWeekdayToken
            ? parseWeekdayToken(firstWeekdayToken)
            : null
          const setPos = parts.bysetpos?.[0] ?? firstWeekday?.ordinal ?? null
          setRecMonthlyMode(
            parts.byweekday && setPos !== null ? 'weekday' : 'day',
          )
          setRecMonthlyWeek(setPos ?? 1)
          setRecMonthlyWeekday(firstWeekday?.day ?? 'MO')
          const start = new Date(event.startDate)
          setRecMonthlyDay(parts.bymonthday?.[0] ?? start.getDate())
          setRecYearlyDay(parts.bymonthday?.[0] ?? start.getDate())
          setRecYearlyMonth(parts.bymonth?.[0] ?? start.getMonth() + 1)
          if (parts.until) {
            setRecEndMode('until')
            setRecUntil(parseRfcStamp(parts.until).date)
          } else if (parts.count !== null) {
            setRecEndMode('count')
            setRecCount(parts.count)
          } else {
            setRecEndMode('never')
          }
        } else {
          const start = new Date(event.startDate)
          setRecMonthlyDay(start.getDate())
          setRecYearlyDay(start.getDate())
          setRecYearlyMonth(start.getMonth() + 1)
        }
      } else {
        resetForm()
        if (initialDate) {
          const dialogStartDate = new Date(initialDate)
          const dialogEndDate =
            initialEndDate && initialEndDate > initialDate
              ? new Date(initialEndDate)
              : new Date(initialDate.getTime() + 30 * 60000)

          setStartDate(dialogStartDate)
          if (calendars.length > 0) {
            setColor(getEventColorByCalendarId(calendars[0].id))
          }
          setEndDate(dialogEndDate)

          const initialHour = getHours(dialogStartDate)
          const initialMinute = getMinutes(dialogStartDate)

          setStartTime({
            hours: initialHour.toString().padStart(2, '0'),
            minutes: initialMinute.toString().padStart(2, '0'),
            rawInput: format(dialogStartDate, 'HH:mm'),
            isCustomInput: false,
          })

          setEndTime({
            hours: getHours(dialogEndDate).toString().padStart(2, '0'),
            minutes: getMinutes(dialogEndDate).toString().padStart(2, '0'),
            rawInput: format(dialogEndDate, 'HH:mm'),
            isCustomInput: false,
          })
        }
      }
    }
  }, [event, calendars, initialDate, initialEndDate, open])

  const resetForm = () => {
    const now = new Date()
    const thirtyMinutesLater = new Date(now.getTime() + 30 * 60000)

    setTitle('')
    setIsAllDay(false)
    setStartDate(now)
    setEndDate(now)
    setStartTime(extractTimeFromDate(now))
    setEndTime(extractTimeFromDate(thirtyMinutesLater))
    setLocation('')
    setParticipants('')
    // New events default to no reminder (ADR-0003). This ran on every
    // new-event open, so leaving it at '0' would reinstate the unwanted
    // at-start chime the ADR exists to remove.
    setNotification(NO_REMINDER)
    setEmailReminder(false)
    setCustomNotificationTime('10')
    setDescription('')
    setColor(EVENT_COLOR_OPTIONS[0].value)
    setSelectedCalendar('')
    setStartTimeError(false)
    setEndTimeError(false)
    setRecurrenceEnabled(false)
    setApplyTo('all')
    setRecFreq('WEEKLY')
    setRecInterval(1)
    setRecEndMode('never')
    setRecCount(10)
    setRecUntil(addDays(new Date(), 365))
    setRecWeeklyDays([])
    setRecMonthlyMode('day')
    setRecMonthlyDay(1)
    setRecMonthlyWeek(1)
    setRecMonthlyWeekday('MO')
    setRecYearlyMonth(1)
    setRecYearlyDay(1)
  }

  const handleStartDateChange = (newDate: Date | undefined) => {
    if (!newDate) return

    setStartDate(newDate)

    const fullNewStartDate = combineDateTime(newDate, startTime)
    const fullCurrentEndDate = getFullEndDate()

    if (fullCurrentEndDate < fullNewStartDate) {
      const newEndDate = new Date(fullNewStartDate)
      newEndDate.setMinutes(newEndDate.getMinutes() + 30)

      setEndDate(newDate)
      setEndTime(extractTimeFromDate(newEndDate))
    }
  }

  const handleStartTimeChange = (hours: string, minutes: string) => {
    setStartTime({
      hours,
      minutes,
      rawInput: `${hours}:${minutes}`,
      isCustomInput: false,
    })

    const newStartDate = set(new Date(startDate), {
      hours: parseInt(hours, 10),
      minutes: parseInt(minutes, 10),
      seconds: 0,
      milliseconds: 0,
    })

    const currentEndDate = getFullEndDate()

    if (currentEndDate <= newStartDate) {
      const newEndDate = new Date(newStartDate)
      newEndDate.setMinutes(newStartDate.getMinutes() + 30)

      setEndTime(extractTimeFromDate(newEndDate))

      if (
        endDate.getDate() !== startDate.getDate() ||
        endDate.getMonth() !== startDate.getMonth() ||
        endDate.getFullYear() !== startDate.getFullYear()
      ) {
        setEndDate(startDate)
      }
    }
  }

  const validateForm = (): boolean => {
    if (startTime.isCustomInput && !validateTimeFormat(startTime.rawInput)) {
      setStartTimeError(true)
      return false
    }

    if (endTime.isCustomInput && !validateTimeFormat(endTime.rawInput)) {
      setEndTimeError(true)
      return false
    }

    const fullStartDate = getFullStartDate()
    const fullEndDate = getFullEndDate()

    if (fullEndDate < fullStartDate) {
      setEndTimeError(true)
      alert(t.endTimeError)
      return false
    }

    return true
  }

  /**
   * Selecting a real reminder is the user gesture we request notification
   * permission from. Asking at delivery time — from inside a timer, as the old
   * code did — is not a gesture, and browsers routinely swallow the prompt and
   * the first reminder with it.
   */
  const handleNotificationChange = (value: string) => {
    setNotification(value)
    if (value === NO_REMINDER) return
    void requestNotificationPermission()
  }

  const validateParticipants = (input: string): string[] | null => {
    const emails = input
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)

    if (emails.length === 0) return []

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    for (const email of emails) {
      if (!emailRegex.test(email)) {
        setParticipantError(`Invalid email: ${email}`)
        return null
      }
    }

    if (emails.length > 20) {
      setParticipantError('Maximum 20 participants allowed')
      return null
    }

    const unique = [...new Set(emails.map((e) => e.toLowerCase()))]
    if (unique.length !== emails.length) {
      setParticipantError('Duplicate emails not allowed')
      return null
    }

    setParticipantError('')
    return emails
  }

  const isRecurringEvent =
    !!event?.rrule || !!event?.seriesId || !!event?.recurrenceId

  const seriesRule =
    event?.rrule ??
    (event?.seriesId
      ? (events.find((e) => e.id === event.seriesId)?.rrule ?? null)
      : null)

  const WEEKDAY_ORDER = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
  const weekdayOfDate = (d: Date) =>
    WEEKDAY_ORDER[d.getDay() === 0 ? 6 : d.getDay() - 1]

  const buildRruleParts = (): RruleParts | null => {
    const base: RruleParts = emptyRruleParts(recFreq, recInterval)
    if (recFreq === 'WEEKLY') {
      const days =
        recWeeklyDays.length > 0
          ? [...recWeeklyDays]
          : [weekdayOfDate(startDate)]
      base.byweekday = days.sort(
        (a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b),
      )
    } else if (recFreq === 'MONTHLY') {
      if (recMonthlyMode === 'day') {
        base.bymonthday = [recMonthlyDay]
      } else {
        base.byweekday = [recMonthlyWeekday]
        base.bysetpos = [recMonthlyWeek]
      }
    } else if (recFreq === 'YEARLY') {
      base.bymonth = [recYearlyMonth]
      base.bymonthday = [recYearlyDay]
    }
    if (recEndMode === 'count') {
      base.count = recCount
    } else if (recEndMode === 'until') {
      base.until = toRfcStamp(recUntil, isAllDay)
    }
    return base
  }

  const rulePreview = (() => {
    if (!recurrenceEnabled || (isRecurringEvent && applyTo !== 'all'))
      return null
    const parts = buildRruleParts()
    if (!parts) return null
    try {
      return rruleFromParts(parts)
    } catch {
      return null
    }
  })()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    const participantEmails = validateParticipants(participants)
    if (participantEmails === null) {
      return
    }

    // "None" means no reminder at all. A custom value that fails to parse is
    // also no reminder — never fall back to 0, which would silently mean
    // "remind at the event's start".
    let notificationMinutes: number | null = null
    if (notification === 'custom') {
      const parsed = Number.parseInt(customNotificationTime, 10)
      notificationMinutes =
        Number.isFinite(parsed) && parsed >= 0 ? parsed : null
    } else if (notification !== NO_REMINDER) {
      const parsed = Number.parseInt(notification, 10)
      notificationMinutes = Number.isFinite(parsed) ? parsed : null
    }

    const fullStartDate = getFullStartDate()
    const fullEndDate = getFullEndDate()
    const normalizedStartDate = isAllDay
      ? set(new Date(startDate), {
          hours: 0,
          minutes: 0,
          seconds: 0,
          milliseconds: 0,
        })
      : fullStartDate
    const normalizedEndDate = isAllDay
      ? set(addDays(new Date(endDate), 1), {
          hours: 0,
          minutes: 0,
          seconds: 0,
          milliseconds: 0,
        })
      : fullEndDate

    const recurring = isRecurringEvent
    let rule: string | null = null
    if (recurrenceEnabled && (recurring ? applyTo === 'all' : true)) {
      const parts = buildRruleParts()
      if (parts) {
        try {
          rule = rruleFromParts(parts)
        } catch {
          rule = null
        }
      }
    }

    const eventData: CalendarEvent = {
      id: event?.id || uuid(),
      title: title.trim() || t.untitledInParentheses,
      isAllDay,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      rrule: recurring
        ? applyTo === 'all'
          ? (rule ?? event.rrule ?? null)
          : (event.rrule ?? null)
        : rule,
      seriesId: event?.seriesId ?? null,
      recurrenceId: event?.recurrenceId ?? null,
      location,
      participants: participantEmails,
      notification: notificationMinutes,
      // No reminder time means nothing to email, whatever the checkbox says.
      emailReminder: notificationMinutes === null ? false : emailReminder,
      description,
      color,
      calendarId:
        selectedCalendar === '__uncategorized__' ? '' : selectedCalendar,
    }

    if (event && recurring) {
      const alreadyInvited = invitedEmailsOf(event)
      setSaveScope(applyTo === 'all' && canAllScope ? 'all' : 'single')
      setParticipantScope(canAllScope ? 'all' : 'single')
      setPendingScopeSubmit({
        eventData,
        emails: participantEmails,
        newEmails: participantEmails.filter(
          (email) => !alreadyInvited.has(email.toLowerCase()),
        ),
      })
      setSaveScopeOpen(true)
      return
    }

    // A NEW recurring event with participants also needs the scope prompt: the
    // participants must land on one occurrence or the whole series.
    if (!event && recurring && participantEmails.length > 0) {
      setSaveScope('all')
      setParticipantScope('all')
      setPendingScopeSubmit({
        eventData,
        emails: participantEmails,
        newEmails: participantEmails,
      })
      setSaveScopeOpen(true)
      return
    }

    if (event) {
      const alreadyInvited = invitedEmailsOf(event)
      const newEmails = participantEmails.filter(
        (email) => !alreadyInvited.has(email.toLowerCase()),
      )
      onEventUpdate(eventData, recurring ? applyTo : undefined)
      onInvitesAdded(event.id, newEmails)
    } else {
      onEventAdd(eventData)
      onInvitesAdded(eventData.id, participantEmails)
      attachPendingMeeting(eventData.id)
    }
  }

  /**
   * A draft event has no row yet, so "Add Zentra Meet" only records the
   * intent; the meeting is created once the event exists.
   */
  const attachPendingMeeting = (eventId: string) => {
    if (!meetingPending) return
    setMeetingPending(false)
    void fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId }),
    }).catch(() => {
      // The event still saved; the organiser can add the meeting again.
    })
  }

  /** Emails already invited, from both the legacy list and the invite rows. */
  const invitedEmailsOf = (target: CalendarEvent): Set<string> =>
    new Set(
      [
        ...(target.participants ?? []),
        ...(target.invites ?? []).map((i) => i.email),
      ].map((email) => email.trim().toLowerCase()),
    )

  const confirmScopeSave = () => {
    if (!pendingScopeSubmit) return
    const { eventData, newEmails } = pendingScopeSubmit

    // Belt guard: never submit a scope that isn't offered. Applies to the
    // participant scope too, which has the same first-occurrence restriction.
    const scope = saveScope === 'all' && !canAllScope ? 'single' : saveScope
    const inviteScope =
      participantScope === 'all' && event && !canAllScope
        ? 'single'
        : participantScope

    if (event) {
      onEventUpdate(eventData, scope)
      onInvitesAdded(event.id, newEmails, inviteScope)
    } else {
      onEventAdd(eventData)
      onInvitesAdded(eventData.id, newEmails, inviteScope)
      attachPendingMeeting(eventData.id)
    }

    setSaveScopeOpen(false)
    setPendingScopeSubmit(null)
    onOpenChange(false)
  }

  const renderTimeSelector = (
    value: TimeInput,
    onChange: (hours: string, minutes: string) => void,
    onCustomInput: (input: string) => void,
    isOpen: boolean,
    setOpen: (open: boolean) => void,
    hasError: boolean,
  ) => {
    const displayTime = value.isCustomInput
      ? value.rawInput
      : `${value.hours}:${value.minutes}`

    return (
      <Popover open={isOpen} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-auto justify-start text-left font-normal',
              hasError && 'border-red-500 text-red-500',
              !displayTime && 'text-muted-foreground',
            )}
          >
            <Clock className="mr-2 h-4 w-4" />
            {displayTime || (isZh ? '选择时间' : 'Select time')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 space-y-3">
            <div className="flex items-center space-x-2">
              <Select
                value={value.hours}
                onValueChange={(newHour) => onChange(newHour, value.minutes)}
              >
                <SelectTrigger className="w-[70px]">
                  <SelectValue placeholder={isZh ? '时' : 'Hour'} />
                </SelectTrigger>
                <SelectContent>
                  {hourOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="text-center">:</span>

              <Select
                value={value.minutes}
                onValueChange={(newMinute) => onChange(value.hours, newMinute)}
              >
                <SelectTrigger className="w-[70px]">
                  <SelectValue placeholder={isZh ? '分' : 'Min'} />
                </SelectTrigger>
                <SelectContent>
                  {minuteOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col space-y-1">
              <Label htmlFor="custom-time">
                {isZh ? '自定义时间 (HH:mm)' : 'Custom time (HH:mm)'}
              </Label>
              <Input
                id="custom-time"
                value={value.isCustomInput ? value.rawInput : ''}
                onChange={(e) => onCustomInput(e.target.value)}
                placeholder="14:30"
                className={cn(hasError && 'border-red-500')}
              />
              {hasError && (
                <p className="text-xs text-red-500">
                  {isZh
                    ? '请使用正确的格式 (HH:mm)'
                    : 'Please use the correct format (HH:mm)'}
                </p>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  const editorAnchorNode = (
    <PopoverAnchor asChild>
      <div style={anchorStyle} />
    </PopoverAnchor>
  )

  const renderedEditorAnchor =
    effectiveAnchorRect && scrollContainerRef?.current
      ? createPortal(editorAnchorNode, scrollContainerRef.current)
      : editorAnchorNode

  return (
    <>
      <RemoveScroll enabled={open}>
        <Popover open={open} onOpenChange={onOpenChange} modal={false}>
          {renderedEditorAnchor}
          <PopoverContent
            side={popoverSide}
            align="center"
            sideOffset={12}
            collisionPadding={12}
            // Height caps at Radix's measured available height, not a vh
            // guess: on a tablet-landscape screen the browser chrome (address
            // bar, tab strip) eats into the viewport, so 85vh overflowed and
            // the submit buttons could never be scrolled into reach.
            // `--radix-popover-content-available-height` is what actually
            // fits between the anchor and the collision boundary.
            className={cn(
              'flex w-[min(96vw,28rem)] max-h-[min(var(--radix-popover-content-available-height),40rem)] flex-col rounded-xl p-0',
              replacesPreview && 'data-open:animate-none',
            )}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => {
              // Radix popups (selects, date pickers) render in portals outside
              // this content; closing the editor when one is clicked would
              // discard the form mid-edit.
              const target = e.target instanceof Element ? e.target : null
              if (target?.closest('[data-radix-popper-content-wrapper]')) {
                e.preventDefault()
              }
            }}
          >
            <div className="flex shrink-0 items-center justify-between px-5 pt-4 pb-2">
              <h2 className="text-lg font-semibold">
                {event ? t.update : t.createEvent}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 -mr-1"
                aria-label={t.cancel}
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
              <form onSubmit={handleSubmit} className="space-y-4 pb-2">
                <div className="space-y-2">
                  <Label htmlFor="title">{t.title}</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="all-day"
                    checked={isAllDay}
                    onCheckedChange={(checked) => {
                      const isChecked = checked as boolean
                      setIsAllDay(isChecked)

                      if (isChecked) {
                        setStartTime({
                          hours: '00',
                          minutes: '00',
                          rawInput: '00:00',
                          isCustomInput: false,
                        })

                        setEndTime({
                          hours: '23',
                          minutes: '59',
                          rawInput: '23:59',
                          isCustomInput: false,
                        })
                      }
                    }}
                  />
                  <Label htmlFor="all-day">{t.allDay}</Label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t.startTime}</Label>
                    <div className="flex flex-col space-y-2">
                      <Popover
                        open={startDateOpen}
                        onOpenChange={setStartDateOpen}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(startDate, 'yyyy-MM-dd')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={(date) => {
                              if (date) {
                                handleStartDateChange(date)
                                setStartDateOpen(false)
                              }
                            }}
                          />
                        </PopoverContent>
                      </Popover>

                      {!isAllDay &&
                        renderTimeSelector(
                          startTime,
                          handleStartTimeChange,
                          handleStartTimeInput,
                          startTimeOpen,
                          setStartTimeOpen,
                          startTimeError,
                        )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t.endTime}</Label>
                    <div className="flex flex-col space-y-2">
                      <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(endDate, 'yyyy-MM-dd')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={(date) => {
                              if (date) {
                                setEndDate(date)
                                setEndDateOpen(false)

                                const fullStartDate = getFullStartDate()
                                const possibleEndDate = combineDateTime(
                                  date,
                                  endTime,
                                )

                                if (possibleEndDate < fullStartDate) {
                                  setEndTimeError(true)
                                } else {
                                  setEndTimeError(false)
                                }
                              }
                            }}
                            disabled={(date) => date < startDate}
                          />
                        </PopoverContent>
                      </Popover>

                      {!isAllDay &&
                        renderTimeSelector(
                          endTime,
                          (hours, minutes) => {
                            setEndTime({
                              hours,
                              minutes,
                              rawInput: `${hours}:${minutes}`,
                              isCustomInput: false,
                            })

                            const fullStartDate = getFullStartDate()
                            const possibleEndDate = set(new Date(endDate), {
                              hours: parseInt(hours, 10),
                              minutes: parseInt(minutes, 10),
                              seconds: 0,
                            })

                            setEndTimeError(possibleEndDate < fullStartDate)
                          },
                          handleEndTimeInput,
                          endTimeOpen,
                          setEndTimeOpen,
                          endTimeError,
                        )}
                    </div>
                    {endTimeError && !isAllDay && (
                      <p className="text-xs text-red-500">{t.endTimeError}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="calendar">{t.calendar}</Label>
                  <Select
                    value={calendarSelectValue}
                    onValueChange={(value) => {
                      setSelectedCalendar(value)
                      if (value !== '__uncategorized__') {
                        setColor(getEventColorByCalendarId(value))
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t.selectCalendar} />
                    </SelectTrigger>
                    <SelectContent>
                      {calendars.length > 0 && (
                        <SelectItem value="__uncategorized__">
                          <div className="flex items-center">
                            <div className="w-4 h-4 rounded-full mr-2 border border-muted-foreground/50" />
                            {t.uncategorized}
                          </div>
                        </SelectItem>
                      )}
                      {calendars.map((calendar) => (
                        <SelectItem key={calendar.id} value={calendar.id}>
                          <div className="flex items-center">
                            <div
                              className={cn(
                                'w-4 h-4 rounded-full mr-2',
                                calendar.color,
                              )}
                            />
                            {calendar.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="color">{t.color}</Label>
                  <Select value={color} onValueChange={setColor}>
                    <SelectTrigger>
                      <SelectValue placeholder={t.selectColor} />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_COLOR_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center">
                            <div
                              className={cn('w-4 h-4 rounded-full mr-2')}
                              style={{
                                backgroundColor:
                                  EVENT_BG_TO_ACCENT[option.value],
                              }}
                            />
                            {t[option.labelKey]}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">{t.location}</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>

                <EventMeetingField
                  eventId={meetingEventId}
                  onPendingChange={setMeetingPending}
                />

                <div className="space-y-2">
                  <Label htmlFor="participants">{t.participants}</Label>
                  <Input
                    id="participants"
                    value={participants}
                    onChange={(e) => {
                      setParticipants(e.target.value)
                      if (participantError) setParticipantError('')
                    }}
                    placeholder={t.participantsPlaceholder}
                  />
                  {participantError && (
                    <p className="text-xs text-destructive">
                      {participantError}
                    </p>
                  )}
                </div>

                {(!event || !isRecurringEvent) && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="repeat"
                      checked={recurrenceEnabled}
                      onCheckedChange={(checked) => {
                        const enabled = checked as boolean
                        setRecurrenceEnabled(enabled)
                        if (enabled) {
                          setRecWeeklyDays([weekdayOfDate(startDate)])
                        }
                      }}
                    />
                    <Label htmlFor="repeat">{t.repeatLabel}</Label>
                  </div>
                )}

                {recurrenceEnabled && (event === null || applyTo === 'all') && (
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="flex items-center gap-2">
                      <Select
                        value={recFreq}
                        onValueChange={(value) =>
                          setRecFreq(
                            value as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY',
                          )
                        }
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DAILY">
                            {t.repeatFrequencyDaily}
                          </SelectItem>
                          <SelectItem value="WEEKLY">
                            {t.repeatFrequencyWeekly}
                          </SelectItem>
                          <SelectItem value="MONTHLY">
                            {t.repeatFrequencyMonthly}
                          </SelectItem>
                          <SelectItem value="YEARLY">
                            {t.repeatFrequencyYearly}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={1}
                          value={recInterval}
                          onChange={(e) =>
                            setRecInterval(
                              Math.max(1, parseInt(e.target.value, 10) || 1),
                            )
                          }
                          className="w-16"
                        />
                        <span className="text-sm text-muted-foreground">
                          {t.repeatEveryIntervalHint}
                        </span>
                      </div>
                    </div>

                    {recFreq === 'WEEKLY' && (
                      <div className="flex flex-wrap gap-1">
                        {WEEKDAY_ORDER.map((d) => {
                          const selected = recWeeklyDays.includes(d)
                          return (
                            <Button
                              key={d}
                              type="button"
                              size="sm"
                              className="h-7 px-2"
                              variant={selected ? 'default' : 'outline'}
                              onClick={() =>
                                setRecWeeklyDays((prev) =>
                                  selected
                                    ? prev.filter((x) => x !== d)
                                    : [...prev, d],
                                )
                              }
                            >
                              {isZh
                                ? ['一', '二', '三', '四', '五', '六', '日'][
                                    WEEKDAY_ORDER.indexOf(d)
                                  ]
                                : d}
                            </Button>
                          )
                        })}
                      </div>
                    )}

                    {recFreq === 'MONTHLY' && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              recMonthlyMode === 'day' ? 'default' : 'outline'
                            }
                            onClick={() => setRecMonthlyMode('day')}
                          >
                            {t.repeatMonthlyModeDay}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              recMonthlyMode === 'weekday'
                                ? 'default'
                                : 'outline'
                            }
                            onClick={() => setRecMonthlyMode('weekday')}
                          >
                            {t.repeatMonthlyModeWeekday}
                          </Button>
                        </div>
                        {recMonthlyMode === 'day' ? (
                          <Input
                            type="number"
                            min={1}
                            max={31}
                            value={recMonthlyDay}
                            onChange={(e) =>
                              setRecMonthlyDay(
                                Math.min(
                                  31,
                                  Math.max(
                                    1,
                                    parseInt(e.target.value, 10) || 1,
                                  ),
                                ),
                              )
                            }
                            className="w-20"
                          />
                        ) : (
                          <div className="flex gap-2">
                            <Select
                              value={String(recMonthlyWeek)}
                              onValueChange={(v) =>
                                setRecMonthlyWeek(parseInt(v, 10))
                              }
                            >
                              <SelectTrigger className="w-[110px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 4, -1].map((w) => (
                                  <SelectItem key={w} value={String(w)}>
                                    {w === -1
                                      ? t.recurrenceLastWeek
                                      : t.recurrenceNthWeek.replace(
                                          '{n}',
                                          String(w),
                                        )}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={recMonthlyWeekday}
                              onValueChange={setRecMonthlyWeekday}
                            >
                              <SelectTrigger className="w-[110px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {WEEKDAY_ORDER.map((d) => (
                                  <SelectItem key={d} value={d}>
                                    {isZh
                                      ? [
                                          '一',
                                          '二',
                                          '三',
                                          '四',
                                          '五',
                                          '六',
                                          '日',
                                        ][WEEKDAY_ORDER.indexOf(d)]
                                      : d}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    )}

                    {recFreq === 'YEARLY' && (
                      <div className="flex gap-2">
                        <Select
                          value={String(recYearlyMonth)}
                          onValueChange={(v) =>
                            setRecYearlyMonth(parseInt(v, 10))
                          }
                        >
                          <SelectTrigger className="w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(
                              (m) => (
                                <SelectItem key={m} value={String(m)}>
                                  {t.recurrenceYearlyMonth.replace(
                                    '{n}',
                                    String(m),
                                  )}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          value={recYearlyDay}
                          onChange={(e) =>
                            setRecYearlyDay(
                              Math.min(
                                31,
                                Math.max(1, parseInt(e.target.value, 10) || 1),
                              ),
                            )
                          }
                          className="w-20"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>{t.repeatEnds}</Label>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={
                            recEndMode === 'never' ? 'default' : 'outline'
                          }
                          onClick={() => setRecEndMode('never')}
                        >
                          {t.repeatEndNever}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={
                            recEndMode === 'count' ? 'default' : 'outline'
                          }
                          onClick={() => setRecEndMode('count')}
                        >
                          {t.repeatEndCount}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={
                            recEndMode === 'until' ? 'default' : 'outline'
                          }
                          onClick={() => setRecEndMode('until')}
                        >
                          {t.repeatEndUntil}
                        </Button>
                      </div>
                      {recEndMode === 'count' && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            value={recCount}
                            onChange={(e) =>
                              setRecCount(
                                Math.max(1, parseInt(e.target.value, 10) || 1),
                              )
                            }
                            className="w-20"
                          />
                          <span className="text-sm text-muted-foreground">
                            {t.repeatOccurrencesSuffix}
                          </span>
                        </div>
                      )}
                      {recEndMode === 'until' && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {format(recUntil, 'yyyy-MM-dd')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={recUntil}
                              onSelect={(date) => {
                                if (date) setRecUntil(date)
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>

                    {rulePreview && (
                      <p className="text-xs font-mono text-muted-foreground">
                        {rulePreview}
                      </p>
                    )}
                  </div>
                )}

                {seriesRule &&
                  isRecurringEvent &&
                  event &&
                  applyTo !== 'all' && (
                    <div className="space-y-2 rounded-md border p-3">
                      <Label>{t.repeatRule}</Label>
                      <p className="text-sm text-muted-foreground">
                        {describeRecurrence(seriesRule, isZh)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.repeatRuleEditHint}
                      </p>
                    </div>
                  )}

                <div className="space-y-2">
                  <Label htmlFor="notification">{t.notification}</Label>
                  <Select
                    value={notification}
                    onValueChange={handleNotificationChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t.selectNotification} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_REMINDER}>
                        {t.noReminder}
                      </SelectItem>
                      <SelectItem value="0">{t.atEventTime}</SelectItem>
                      <SelectItem value="5">
                        {t.minutesBefore.replace('{minutes}', '5')}
                      </SelectItem>
                      <SelectItem value="15">
                        {t.minutesBefore.replace('{minutes}', '15')}
                      </SelectItem>
                      <SelectItem value="30">
                        {t.minutesBefore.replace('{minutes}', '30')}
                      </SelectItem>
                      <SelectItem value="60">
                        {t.hourBefore.replace('{hours}', '1')}
                      </SelectItem>
                      <SelectItem value="custom">{t.customTime}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/*
              Disabled with no reminder selected: an email reminder needs a
              reminder time to be sent at. See ADR-0010.
            */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="email-reminder"
                    checked={emailReminder}
                    disabled={notification === NO_REMINDER}
                    onCheckedChange={(checked) =>
                      setEmailReminder(checked as boolean)
                    }
                  />
                  <Label
                    htmlFor="email-reminder"
                    className={
                      notification === NO_REMINDER
                        ? 'text-muted-foreground'
                        : ''
                    }
                  >
                    {t.emailReminder}
                  </Label>
                </div>

                {notification === 'custom' && (
                  <div className="space-y-2">
                    <Label htmlFor="custom-notification-time">
                      {t.customTimeMinutes}
                    </Label>
                    <Input
                      id="custom-notification-time"
                      type="number"
                      min="1"
                      value={customNotificationTime}
                      onChange={(e) =>
                        setCustomNotificationTime(e.target.value)
                      }
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="description">{t.description}</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  {event && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => {
                        onEventDelete(
                          event.id,
                          isRecurringEvent ? applyTo : undefined,
                        )
                        onOpenChange(false)
                      }}
                    >
                      {t.delete}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    {t.cancel}
                  </Button>
                  <Button type="submit">{event ? t.update : t.save}</Button>
                </div>
              </form>
            </div>
          </PopoverContent>
        </Popover>
      </RemoveScroll>

      <AlertDialog open={saveScopeOpen} onOpenChange={setSaveScopeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.repeatScope}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.updateEventScopeDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <RadioGroup
            value={saveScope}
            onValueChange={(value) =>
              setSaveScope(value as 'single' | 'following' | 'all')
            }
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="single" id="save-scope-single" />
              <Label htmlFor="save-scope-single">{t.repeatScopeSingle}</Label>
            </div>
            {!canAllScope && (
              <div className="flex items-center gap-2">
                <RadioGroupItem value="following" id="save-scope-following" />
                <Label htmlFor="save-scope-following">
                  {t.repeatScopeFollowing}
                </Label>
              </div>
            )}
            {canAllScope && (
              <div className="flex items-center gap-2">
                <RadioGroupItem value="all" id="save-scope-all" />
                <Label htmlFor="save-scope-all">{t.repeatScopeAll}</Label>
              </div>
            )}
          </RadioGroup>

          {/*
            Only shown when participants actually changed — a third chained
            confirmation dialog would be punishing, so this lives here instead.
          */}
          {(pendingScopeSubmit?.newEmails.length ?? 0) > 0 && (
            <div className="space-y-2 border-t pt-4">
              <Label>{t.participantScope}</Label>
              <p className="text-xs text-muted-foreground">
                {t.participantScopeDescription}
              </p>
              <RadioGroup
                value={participantScope}
                onValueChange={(value) =>
                  setParticipantScope(value as 'single' | 'following' | 'all')
                }
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="single" id="invite-scope-single" />
                  <Label htmlFor="invite-scope-single">
                    {t.repeatScopeSingle}
                  </Label>
                </div>
                {event && !canAllScope && (
                  <div className="flex items-center gap-2">
                    <RadioGroupItem
                      value="following"
                      id="invite-scope-following"
                    />
                    <Label htmlFor="invite-scope-following">
                      {t.repeatScopeFollowing}
                    </Label>
                  </div>
                )}
                {(!event || canAllScope) && (
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="all" id="invite-scope-all" />
                    <Label htmlFor="invite-scope-all">{t.repeatScopeAll}</Label>
                  </div>
                )}
              </RadioGroup>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingScopeSubmit(null)}>
              {t.cancel}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmScopeSave}>
              {t.update}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
