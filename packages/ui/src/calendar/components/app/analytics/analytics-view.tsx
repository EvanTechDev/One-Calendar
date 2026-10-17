'use client'

import TimeAnalyticsComponent from '#calendar/components/app/analytics/time-analytics'
import { useMemo, useEffect, useState } from 'react'
import {
  useCalendar,
  eventDataToCalendarEvent,
} from '#calendar/components/providers/calendar-context'
import { useEvents } from '#calendar/components/providers/data-provider'
import { analyticsLoadRange } from '#calendar/lib/analytics/load-range'
import { containsCalendarRange } from '#calendar/lib/calendar-range'
import CalendarViewLoading from '../calendar-view-loading'
import { translations, useLanguage } from '@zntr/i18n/calendar'
import { Button } from '@zntr/ui/button'
import { ArrowLeft } from 'lucide-react'

interface AnalyticsViewProps {
  timezone: string
  onCreateEvent: (startDate: Date, endDate: Date) => void
  onBackToCalendar?: () => void
}

export default function AnalyticsView({
  timezone,
  onBackToCalendar,
}: AnalyticsViewProps) {
  const { calendars } = useCalendar()
  const [language] = useLanguage()
  const t = translations[language]
  const [now] = useState(() => new Date())
  const range = useMemo(
    () => analyticsLoadRange(now, timezone),
    [now, timezone],
  )
  const {
    events,
    eventsRange,
    setEventsRange,
    eventsLoading,
    eventsError,
    refreshEvents,
  } = useEvents()
  useEffect(() => setEventsRange(range), [range, setEventsRange])
  const rangeReady = containsCalendarRange(eventsRange, range)
  const calendarEvents = useMemo(
    () => events.map(eventDataToCalendarEvent),
    [events],
  )

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {t.analytics}
        </h1>
        <Button variant="ghost" size="sm" onClick={() => onBackToCalendar?.()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t.back}
        </Button>
      </div>
      {/* No language in the key: TimeAnalyticsComponent has its own
          useLanguage() subscription, so a language change re-renders it. The
          key used to carry a counter bumped by a hand-rolled pair of window
          listeners here, which forced a full remount — discarding the
          analysis the child had just computed — to achieve what a
          subscription already did. */}
      {!rangeReady ? (
        <CalendarViewLoading />
      ) : eventsError ? (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>{eventsError.message}</p>
          <Button
            variant="outline"
            onClick={() => void refreshEvents().catch(() => {})}
          >
            {t.aiSearchRetry}
          </Button>
        </div>
      ) : eventsLoading ? (
        <CalendarViewLoading />
      ) : (
        <TimeAnalyticsComponent
          events={calendarEvents}
          calendars={calendars}
          now={now}
        />
      )}
    </div>
  )
}
