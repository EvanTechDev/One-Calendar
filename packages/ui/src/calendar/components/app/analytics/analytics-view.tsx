'use client'

import TimeAnalyticsComponent from '#calendar/components/app/analytics/time-analytics'
import type { CalendarEvent } from '#calendar/components/app/calendar'
import { useCalendar } from '#calendar/components/providers/calendar-context'
import { translations, useLanguage } from '@zntr/i18n/calendar'
import { Button } from '@zntr/ui/button'
import { ArrowLeft } from 'lucide-react'

interface AnalyticsViewProps {
  events: CalendarEvent[]
  onCreateEvent: (startDate: Date, endDate: Date) => void
  onBackToCalendar?: () => void
}

export default function AnalyticsView({
  events,
  onBackToCalendar,
}: AnalyticsViewProps) {
  const { calendars } = useCalendar()
  const [language] = useLanguage()
  const t = translations[language]

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
      <TimeAnalyticsComponent events={events} calendars={calendars} />
    </div>
  )
}
