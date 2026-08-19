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
import { Popover, PopoverContent, PopoverTrigger } from '@zntr/ui/popover'
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
import { Calendar as CalendarIcon, Clock } from 'lucide-react'
import { isZhLanguage, translations } from '@zntr/i18n/calendar'
import { useCalendar } from '@/components/providers/calendar-context'
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
} from '@/components/app/views/event-colors'
import {
  describeRecurrence,
  rruleFromParts,
  rruleToParts,
  toRfcStamp,
  parseRfcStamp,
  type RruleParts,
} from '@/lib/recurrence'
import type { ViewConfig } from '@/lib/calendar-types'

const hourOptions = Array.from({ length: 24 }, (_, i) => ({
  value: i.toString().padStart(2, '0'),
  label: i.toString().padStart(2, '0'),
}))

const minuteOptions = Array.from({ length: 12 }, (_, i) => ({
  value: (i * 5).toString().padStart(2, '0'),
  label: (i * 5).toString().padStart(2, '0'),
}))

interface EventDialogProps {
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
  onInvitesAdded: (eventId: string, emails: string[]) => void
  initialDate: Date
  initialEndDate?: Date | null
  event: CalendarEvent | null
  config: ViewConfig
}

interface TimeInput {
  hours: string
  minutes: string
  rawInput: string
  isCustomInput: boolean
}

export default function EventDialog({
  open,
  onOpenChange,
  onEventAdd,
  onEventUpdate,
  onEventDelete,
  onInvitesAdded,
  initialDate,
  initialEndDate,
  event,
  config,
}: EventDialogProps) {
  if (!config) return null
  const { calendars, events } = useCalendar()
  const [participants, setParticipants] = useState('')
  const [customNotificationTime, setCustomNotificationTime] = useState('10')
  const [selectedCalendar, setSelectedCalendar] = useState('')
  const [notification, setNotification] = useState('0')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
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
  const [pendingScopeSubmit, setPendingScopeSubmit] = useState<{
    eventData: CalendarEvent
    emails: string[]
  } | null>(null)
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
        if (event.notification !== undefined) {
          if (
            event.notification > 0 &&
            event.notification !== 5 &&
            event.notification !== 15 &&
            event.notification !== 30 &&
            event.notification !== 60
          ) {
            setNotification('custom')
            setCustomNotificationTime(event.notification.toString())
          } else {
            setNotification(event.notification.toString())
          }
        } else {
          setNotification('0')
        }
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
          setRecWeeklyDays(parts.byweekday ?? [])
          setRecMonthlyMode(
            parts.byweekday && parts.bysetpos !== null ? 'weekday' : 'day',
          )
          setRecMonthlyWeek(parts.bysetpos ?? 1)
          setRecMonthlyWeekday(parts.byweekday?.[0] ?? 'MO')
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
    setNotification('0')
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
    const base: RruleParts = {
      freq: recFreq,
      interval: recInterval,
      byweekday: null,
      bymonthday: null,
      bysetpos: null,
      bymonth: null,
      until: null,
      count: null,
    }
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
        base.bysetpos = recMonthlyWeek
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

    let notificationMinutes = Number.parseInt(notification)
    if (notification === 'custom') {
      notificationMinutes = Number.parseInt(customNotificationTime)
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
      description,
      color,
      calendarId:
        selectedCalendar === '__uncategorized__' ? '' : selectedCalendar,
    }

    if (event && recurring) {
      setSaveScope(applyTo === 'all' ? 'all' : 'single')
      setPendingScopeSubmit({ eventData, emails: participantEmails })
      setSaveScopeOpen(true)
      return
    }

    if (event) {
      const alreadyInvited = new Set(
        [
          ...(event.participants ?? []),
          ...(event.invites ?? []).map((i) => i.email),
        ].map((email) => email.trim().toLowerCase()),
      )
      const newEmails = participantEmails.filter(
        (email) => !alreadyInvited.has(email.toLowerCase()),
      )
      onEventUpdate(eventData, recurring ? applyTo : undefined)
      onInvitesAdded(event.id, newEmails)
    } else {
      onEventAdd(eventData)
      onInvitesAdded(eventData.id, participantEmails)
    }
  }

  const confirmScopeSave = () => {
    if (!pendingScopeSubmit || !event) return
    const alreadyInvited = new Set(
      [
        ...(event.participants ?? []),
        ...(event.invites ?? []).map((i) => i.email),
      ].map((email) => email.trim().toLowerCase()),
    )
    const newEmails = pendingScopeSubmit.emails.filter(
      (email) => !alreadyInvited.has(email.toLowerCase()),
    )
    onEventUpdate(pendingScopeSubmit.eventData, saveScope)
    onInvitesAdded(event.id, newEmails)
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <div className="flex justify-between items-center">
              <DialogTitle>{event ? t.update : t.createEvent}</DialogTitle>
            </div>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pb-6">
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
                  <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
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
                            backgroundColor: EVENT_BG_TO_ACCENT[option.value],
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
                <p className="text-xs text-destructive">{participantError}</p>
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
                          recMonthlyMode === 'weekday' ? 'default' : 'outline'
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
                              Math.max(1, parseInt(e.target.value, 10) || 1),
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
                                  ? ['一', '二', '三', '四', '五', '六', '日'][
                                      WEEKDAY_ORDER.indexOf(d)
                                    ]
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
                      onValueChange={(v) => setRecYearlyMonth(parseInt(v, 10))}
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
                      variant={recEndMode === 'never' ? 'default' : 'outline'}
                      onClick={() => setRecEndMode('never')}
                    >
                      {t.repeatEndNever}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={recEndMode === 'count' ? 'default' : 'outline'}
                      onClick={() => setRecEndMode('count')}
                    >
                      {t.repeatEndCount}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={recEndMode === 'until' ? 'default' : 'outline'}
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

            {seriesRule && isRecurringEvent && event && applyTo !== 'all' && (
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
              <Select value={notification} onValueChange={setNotification}>
                <SelectTrigger>
                  <SelectValue placeholder={t.selectNotification} />
                </SelectTrigger>
                <SelectContent>
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
                  onChange={(e) => setCustomNotificationTime(e.target.value)}
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
        </DialogContent>
      </Dialog>

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
            <div className="flex items-center gap-2">
              <RadioGroupItem value="following" id="save-scope-following" />
              <Label htmlFor="save-scope-following">
                {t.repeatScopeFollowing}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="all" id="save-scope-all" />
              <Label htmlFor="save-scope-all">{t.repeatScopeAll}</Label>
            </div>
          </RadioGroup>
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
