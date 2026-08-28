'use client'

import TimeAnalyticsComponent from '@/components/app/analytics/time-analytics'
import type { CalendarEvent } from '@/components/app/calendar'
import { useCalendar } from '@/components/providers/calendar-context'
import { translations, useLanguage } from '@zntr/i18n/calendar'
import { useState, useEffect } from 'react'
import { Button } from '@zntr/ui/button'
import { ArrowLeft } from 'lucide-react'

interface AnalyticsViewProps {
  events: CalendarEvent[]
  onCreateEvent: (startDate: Date, endDate: Date) => void
  onBackToCalendar?: () => void
  isSidebarTransitioning?: boolean
}

export default function AnalyticsView({
  events,
  onBackToCalendar,
  isSidebarTransitioning = false,
}: AnalyticsViewProps) {
  const { calendars } = useCalendar()
  const [language] = useLanguage()
  const t = translations[language]
  const [_forceUpdate, _setForceUpdate] = useState(0)

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'preferred-language') {
        _setForceUpdate((prev) => prev + 1)
      }
    }

    const handleLanguageChange = () => {
      _setForceUpdate((prev) => prev + 1)
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('languagechange', handleLanguageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('languagechange', handleLanguageChange)
    }
  }, [])

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
      <TimeAnalyticsComponent
        events={events}
        calendars={calendars}
        key={`time-analytics-${language}-${_forceUpdate}`}
        isSidebarTransitioning={isSidebarTransitioning}
      />
    </div>
  )
}
